---
title: Google Tunix Hackathon
draft: false
tags:
  - LLM
  - reinforcement-learning
  - hackathon
aliases: []
published_at: '2026-05-07'
---
# Google Tunix Hackathon

## Overview

**Open-source [[fixture-rag-overview|LLM]] reasoning model training competition**

- **Core Task**: Fine-tune reasoning models using Google's JAX-based post-training library Tunix with Gemma2 (2B) or Gemma3 (1B) on TPU infrastructure
- **No external dataset provided**
- **Goal**: Train models to explicitly generate reasoning traces while solving problems accurately

## Timeline

- **Start**: November 11, 2025
- **Deadline**: January 12, 2026
- **Review Period**: January 13–23
- **Results**: January 26

## Competition Objectives

Create a model that simultaneously satisfies two requirements:

1. **Solve problems accurately**
   - Output final answer in `<answer>` block

2. **Show transparent reasoning process**
   - Output coherent reasoning trace in `<reasoning>` block
   - Format:
     ```json
     <reasoning> ...thinking trace... </reasoning>
     <answer> final_answer </answer>
     ```
   - Quality depends on: step-by-step thinking, logical flow, self-error checking, conclusion derivation—not merely length

## Resources

- **TPU Session**: 9 hours per session
- **Weekly Limit**: 20 hours
- **Model Sizes**: Gemma2 2B or Gemma3 1B
- **RL Method**: GRPO-based
- **Constraints**: No multimodal, no tool use, output tokens < 1000

## Submission Requirements

### 1. Kaggle Writeup
- Maximum 1500 words
- Include title, subtitle, analysis

### 2. Media Gallery
- Cover image (required)
- Video ≤ 3 minutes (YouTube upload required)
  - Project introduction and process explanation

### 3. Public Notebook
- Must contain tuning code
- Checkpoint files must be generated as notebook output (safetensors format not allowed)
- Must be reproducible
- Must be public (auto-converted to public after deadline if submitted private)

## Evaluation Criteria

| Category | Points | Details |
|----------|--------|----------|
| **Notebook Quality** | 35 | Clear, detailed notebook with required elements: training data, hyperparameters, prompt, training strategy/techniques. Reference: Gemma2 Starter Notebook. Must work within TPU constraints (9h/session, 20h/week). Output tokens < 1K. English only. |
| **Model Quality (Single Session)** | 45 | Model must be generated in single 9-hour TPU session. Checkpoint loadable via Tunix + Gemma2/3 code. Must follow output format. Evaluated on reasoning trace + final answer using LLM-as-judge + human judgment. Domains: creative writing, ideation, summarization, math, coding, basic science. |
| **Video Quality** | 20 | ≤3 minutes, clear educational value. Explain Tunix reasoning model training well. High production quality matching actual work. |
| **Model Quality (Multi-session, optional)** | 15 | Save and load intermediate checkpoints across multiple TPU sessions. Private data allowed. Must specify model name/ID at notebook end. Must be loadable via Gemma2/3 + Tunix. Safetensors not allowed. Missing specification = 0 points. |

## Official Resources

### Tunix
- GitHub: https://github.com/google/tunix/
- Documentation: https://tunix.readthedocs.io/en/latest/index.html

### Kaggle Starter Notebooks
- Gemma2 2B GRPO Demo: https://www.kaggle.com/code/windmaple/grpo-demo-gemma2-2b
- Gemma3 1B GRPO Demo: https://www.kaggle.com/code/windmaple/grpo-demo-gemma3-1b

### Framework Documentation
- JAX: https://jax.dev/
- Flax: https://flax.readthedocs.io/

### Key Research Papers
- DeepSeek-R1: https://arxiv.org/abs/2501.12948
- Rubrics as Rewards: https://arxiv.org/abs/2507.17746
- RLVR Extension: https://arxiv.org/pdf/2506.18254
- Bridging Offline & Online RL: https://arxiv.org/pdf/2506.21495

## Team Progress & Plan

### Current Status
- Building foundational reinforcement learning knowledge through study
- Reviewing DeepSeek-R1 paper
- Reading and extracting insights from competition-provided reasoning research papers
- Understanding baseline code

### Future Plan
- Explore recent LLM post-training papers to gain insights on:
  - Evaluation methodologies and benchmark datasets (current competition lacks clear evaluation guidance)
  - Performance improvement techniques through LLM post-training
  - Implement multiple methodologies
