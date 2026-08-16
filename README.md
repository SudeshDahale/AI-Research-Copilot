# AI Research Copilot

A comprehensive AI tool for research assistance

## Overview

AI Research Copilot is a monolithic application designed to assist researchers in their work by leveraging AI capabilities. The project consists of a TypeScript frontend for user interaction and a Python backend that provides API endpoints and handles the business logic required for various research tasks.

## Features

- User-friendly interface built with TypeScript for seamless interaction.
- Python-based backend that handles business logic and API requests.
- Various agents to perform specific research tasks like summarization, gap detection, and literature review.
- Integrated with a caching mechanism for improved performance.
- Robust authentication and document management capabilities.

## Quick Start

```bash
git clone https://github.com/SudeshDahale/AI-Research-Copilot.git
cd AI-Research-Copilot/backend
pip install -r requirements.txt
# Ensure to set the environment variables as per .env.example
python main.py
```

## Architecture

The application is structured as a monolith, consisting of a frontend developed in TypeScript and a backend developed in Python. The frontend communicates with the backend API for all its functionalities, while the backend serves core business logic and manages data storage.

---
*This file is kept in sync by [AutoScribe](https://github.com) — edits here may be overwritten on the next sync.*
