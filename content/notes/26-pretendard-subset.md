---
title: "Pretendard Subset for Web"
tags: [fonts, web, korean, pretendard, subsetting]
date: 2026-04-19
---

TL;DR: Subset Pretendard 한글 + Latin 동시, pyftsubset으로 ~40-50kb/weight. Split unicode-range, font-display: swap, preload link 태그.

## 문제

Pretendard는 훌륭한 한중일 폰트지만, 전체 파일 200-300kb. meshblog은 한글+영문만 필요 → subset으로 50% 이상 절감.

## Subsetting 도구

```bash
pip install fonttools
```

## Unicode 범위 파악

한글 유니코드:
- Hangul Syllables: U+AC00–U+D7A3 (약 11,000자)
- Hangul Jamo: U+1100–U+11FF

라틴 (영어):
- Basic Latin: U+0020–U+007E
- Latin Extended: U+00A0–U+017F

## pyftsubset 사용

```bash
# Pretendard-Bold.ttf를 한글+기본 라틴으로 subset
pyftsubset \
  Pretendard-Bold.ttf \
  --unicodes=U+0020-007E,U+00A0-017F,U+AC00-D7A3 \
  --output-file=Pretendard-Bold-subset.ttf \
  --flavor=woff2
```

결과: ~45kb (원본 250kb에서 82% 감소).

## 분할 로드 (선택사항)

한글과 라틴을 분리하면 사용자가 필요한 것만 로드:

```bash
# 라틴만
pyftsubset Pretendard-Bold.ttf \
  --unicodes=U+0020-007E,U+00A0-017F \
  --output-file=Pretendard-Bold-latin.woff2 \
  --flavor=woff2

# 한글만
pyftsubset Pretendard-Bold.ttf \
  --unicodes=U+AC00-D7A3,U+1100-11FF \
  --output-file=Pretendard-Bold-korean.woff2 \
  --flavor=woff2
```

CSS:

```css
@font-face {
  font-family: "Pretendard";
  src: url("/fonts/Pretendard-Bold-latin.woff2") format("woff2");
  unicode-range: U+0020-007E, U+00A0-017F;
  font-weight: 700;
}

@font-face {
  font-family: "Pretendard";
  src: url("/fonts/Pretendard-Bold-korean.woff2") format("woff2");
  unicode-range: U+AC00-D7A3, U+1100-11FF;
  font-weight: 700;
}
```

브라우저가 필요한 파일만 다운로드.

## 로딩 전략

### font-display: swap

```css
@font-face {
  font-family: "Pretendard";
  src: url("/fonts/Pretendard-Bold.woff2") format("woff2");
  font-display: swap;
  font-weight: 700;
}
```

- `swap`: 시스템 폰트로 먼저 표시, 웹폰트 로드되면 교체. UX 최우선.

### Preload Link

```html
<link rel="preload" as="font" href="/fonts/Pretendard-Bold.woff2" type="font/woff2" crossorigin>
```

Critical path에 폰트를 포함시켜 병렬 로드.

## 가중치별 크기

pyftsubset 후 현실적 크기 (400–900 가중치 모두 한글+라틴):

| Weight | 크기 |
|--------|------|
| 400 Regular | 42kb |
| 500 Medium | 44kb |
| 600 Semi Bold | 46kb |
| 700 Bold | 48kb |
| 900 Black | 52kb |

5개 가중치 = ~230kb (원본 1.2MB에서 81% 절감).

## meshblog 적용

```bash
for weight in 400 500 600 700 900; do
  pyftsubset "Pretendard-$weight.ttf" \
    --unicodes=U+0020-007E,U+00A0-017F,U+AC00-D7A3 \
    --flavor=woff2 \
    --output-file="public/fonts/Pretendard-$weight.woff2"
done
```

CSS에서 `font-family: Pretendard` 사용, font-display: swap. 브라우저 폰트와의 FOIT 최소화.
