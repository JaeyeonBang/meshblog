---
title: "SQLite WAL 모드"
tags: [sqlite, wal, concurrency, database]
date: 2026-04-19
---

TL;DR: WAL (Write-Ahead Logging) = 동시 읽기를 허용하는 SQLite 저널 모드. 충돌 위험 없고 읽기 성능 향상. 크래시 시 복구 비용이 조금 더 크다.

## WAL이란

기본 SQLite는 "direct journal mode": 쓰기 시 파일을 잠근다. 읽기는 쓰기가 끝날 때까지 대기한다.

WAL (Write-Ahead Logging):
- 쓰기는 `.wal` 파일에 먼저 기록
- 읽기는 주 DB 파일과 WAL을 동시에 읽음
- 체크포인트: WAL → 주 파일 병합

결과: 읽기와 쓰기가 서로 블록하지 않음.

## 설정

```sql
PRAGMA journal_mode = WAL;
```

한 번만 실행하면 된다. 이후 연결은 자동으로 WAL 모드 사용.

```typescript
// 첫 연결 때
db.exec("PRAGMA journal_mode = WAL")

// 또는 URI 설정
const db = new Database("file:data.db?mode=memory&journal=WAL")
```

## 장점

1. **동시 읽기**: 쓰기 중에도 여러 읽기 가능
2. **읽기 성능**: 주 파일 접근 감소, 캐시 효율 증가
3. **배치 쓰기**: 여러 트랜잭션을 한 번에 체크포인트 (비용 절감)

meshblog에서: note 분석 중 동시에 새 note 저장 가능.

## 단점

1. **크래시 복구**: 시스템 크래시 시 WAL 파일이 주 DB와 동기화되지 않을 수 있음. 재시작 시 복구 필요 (몇 초).
2. **파일 수**: `.db-wal`, `.db-shm` 추가 파일 생성 (네트워크 FS에서 문제)
3. **fsck**: 네트워크 드라이브나 일부 클라우드에선 지원 안 함.

## 언제 사용

**WAL 사용:**
- 로컬 SSD/HDD (안정적)
- 동시 읽기/쓰기가 많은 앱
- 프로덕션 서버

**기본 모드 사용:**
- 네트워크 FS (NFS, SMB)
- read-only 데이터베이스
- 모바일 (배터리 수명이 중요)

meshblog는 로컬 SQLite → WAL 권장.

## 복구 검증

```bash
sqlite3 data.db "PRAGMA integrity_check;"
# "ok" 출력 = 안전
```

크래시 후 이 명령을 실행하면 WAL이 자동으로 재생되고 정합성이 검증된다.
