---
title: 'ODQA Pipeline: Lessons from a Two-Week Sprint'
draft: false
date: '2026-05-07'
tags:
  - ODQA
  - MRC
  - Retriever
  - Reader
  - KorQuAD
published_at: '2026-05-07'
---
Two weeks. Six engineers. One Korean open-domain QA leaderboard. The final score is the product of retriever accuracy times reader accuracy, which means a weak link anywhere collapses everything downstream. What follows is what survived contact with the deadline.

## Score = Retriever × Reader

The framing that anchored every later decision was multiplicative, not additive. If the retriever hands the reader the wrong document, no amount of reader cleverness recovers the answer; if the reader cannot extract a span from a correct document, retrieval was wasted compute. The team made resource allocation across the two stages an explicit planning constraint rather than an afterthought, given fixed GPUs and a 2-week clock [[odqa-wrap-up-report|the wrap-up report]] makes this trade-off the central organizing principle of the project.

## Refactor the baseline, but not all the way

The provided `mrc_baseline` was readable as a tour of the ODQA flow but unworkable as a team codebase: low modularity, nested functions, and high cross-file coupling guaranteed merge conflicts the moment two people touched it. The first instinct — refactor the baseline into a modular shape — produced too much non-experimental input. The team flipped the direction: start from a clean modular skeleton and port baseline ideas into it. A later attempt to migrate config from JSON to dataclasses was abandoned mid-sprint because the cost of rewriting every argument path while teammates were actively shipping modules was simply too high [[odqa-wrap-up-report|as the wrap-up report]] documents. The lesson the team wrote down explicitly: invest in environment setup early, because mid-sprint refactors are taxed by every parallel branch in flight.

## EM rewards encoders; F1 reveals near-misses

Exact Match was the leaderboard metric, and EM is unforgiving — one stray token and the score is zero. Encoders that point to start/end positions in the context inherit the source string verbatim and avoid generation drift, which biases the metric in their favor. F1 was kept as a secondary signal precisely because EM cannot distinguish 'completely wrong' from 'almost right' — a model trending from 'Obama' toward 'Barack Obama' is invisible on EM but visible on F1 [[odqa-wrap-up-report|the report]] treats F1 as a robustness gauge for steering experiments, not a target to optimize.

## Wikipedia corpus shape drove model choice

Roughly 60,000 Wikipedia documents, with around 3,000 duplicates and ~600 with cosine similarity 1.000 under dense embedding. Those near-identical pairs were excluded from negative sampling — feeding a retriever 'wrong' documents that are actually paraphrases of the right one teaches the wrong gradient. Average document length was 404 tokens, comfortably inside BERT's 512 window, which made BM25 a strong default since the algorithm depends on tf/idf signals that degrade with very long documents. But the maximum was 27,539 tokens, forcing either sliding-window reading or a long-context model. KoBigbird, with its 4096-token window, was tried and delivered a +4% EM gain over `klue/bert-base` even though it was not the absolute best [[odqa-wrap-up-report|per the corpus analysis]].

## Stride beat truncation for long contexts

On the train/validation splits, mean context length was 495–500 tokens with a max of 1,172 — already at BERT's input ceiling on average. Naively truncating contexts to fit lost answer spans; sliding the window with a stride preserved them. The team found empirically that stride-based chunking caught more correct answers than hard truncation, and tested stride values of 64, 128, and 256 against `max_length=512` [[odqa-wrap-up-report|the data section]] frames this as a practical necessity rather than an optimization, given the distribution of context lengths.

## What two weeks actually look like

The plan on paper was three phases: explore and refactor (Dec 1–3), merge and experiment (Dec 4–6), improve and finalize (Dec 7–11). Reality compressed everything into overlapping tracks — retriever exploration ran Dec 4–8, reader exploration Dec 4–7, pipeline improvements (negative sampling, curriculum learning, hyperparameter tuning) Dec 7–10, and ensemble plus K-fold voting on the final day. The team's stated goal was deliberately not 'win the leaderboard' but 'each person walks away with at least one thing learned' — a hedge against the demoralizing volatility of a 2-week sprint where one bad ablation can sink a day [[odqa-wrap-up-report|the project framing]] makes this an explicit anti-burnout decision.

## Roles split along the pipeline seam

Six members, six lanes. Retriever work spread across BM25/ElasticSearch exploration, dense retrieval with Faiss, Qwen LoRA training, and reranking with LLM-as-judge. Reader work covered model comparison, CNN-layer additions, and curriculum learning. Data work covered EDA, external datasets, monoQA, task-adaptive pre-training, and negative sampling. The team lead absorbed the modularization refactor and ensemble work — the two tasks where one person owning the whole shape pays back fastest [[odqa-wrap-up-report|the role table]] reads as a deliberate split along the retriever/reader seam, with data and infra straddling both.

## Conclusion

The durable lessons here are not about which model won. They are about the shape of the problem: multiplicative scoring punishes imbalanced effort, EM punishes generative drift, and a corpus with a fat right tail of long documents quietly dictates which architectures are even viable. The refactor story is the most honest one — the team tried the ambitious version, hit the cost wall, and shipped the pragmatic one. That is what a two-week sprint actually optimizes for.

## Sources

- [[odqa-wrap-up-report|ODQA Wrap-up Report]]
