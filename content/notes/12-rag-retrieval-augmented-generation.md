---
title: "RAG: Retrieval-Augmented Generation Explained"
tags: [rag, llm, embeddings, vector-search, knowledge-base]
date: 2026-01-12
---

RAG (Retrieval-Augmented Generation) is a technique that improves LLM responses by providing relevant context at query time.

## The Problem RAG Solves

LLMs have a knowledge cutoff. They don't know about:
- Your private documents
- Events after training
- Domain-specific internal knowledge

RAG addresses this by retrieving relevant documents and including them in the prompt.

## How RAG Works

1. **Ingestion**: Split documents into chunks, generate embeddings, store in vector database
2. **Query**: Embed the user's question, find top-K similar chunks
3. **Generation**: Send retrieved chunks + question to LLM, get grounded answer

## Pre-generated vs Runtime RAG

**Runtime RAG** (traditional): Query at read time, costs API tokens per user request.

**Pre-generated RAG** (meshblog approach): Generate Q&A at build time, serve as static JSON. Zero runtime LLM cost, zero latency.

The tradeoff: pre-generated content is stale until rebuild. For a personal knowledge base that the owner rebuilds regularly, this is fine.

## Vector Search at Small Scale

For <1000 notes, you don't need a vector database:
- Load all embeddings into memory (~6MB for 1000 notes × 1536 dims × 4 bytes)
- Compute cosine similarity in JavaScript (<10ms)
- Sort and return top-K

At 10,000+ notes, switch to sqlite-vss, Chroma, or Pinecone.

## Entity Extraction as Structured RAG

Instead of (or in addition to) vector search, meshblog extracts named entities from notes. This creates a structured knowledge graph that enables graph-based retrieval — more precise than cosine similarity alone.
