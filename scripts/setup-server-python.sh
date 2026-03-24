#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="${ROOT_DIR}/.venv-server"
PYTHON_BIN="${PYTHON_BIN:-python3}"

echo "[1/5] Creating shared server virtual environment at ${VENV_DIR}"
"${PYTHON_BIN}" -m venv "${VENV_DIR}"

source "${VENV_DIR}/bin/activate"

echo "[2/5] Upgrading pip tooling"
python -m pip install --upgrade pip setuptools wheel

echo "[3/5] Installing Python dependencies"
python -m pip install \
  -r "${ROOT_DIR}/VISA-ASK-SYSTEM/requirements.txt" \
  -r "${ROOT_DIR}/app/trip_generator/requirements.txt" \
  -r "${ROOT_DIR}/explanation_letter_generator/requirements.txt" \
  -r "${ROOT_DIR}/app/material_review/tencent_requirements.txt" \
  -r "${ROOT_DIR}/app/monitor/tls-monitor/requirements.txt" \
  -r "${ROOT_DIR}/services/usvisa-runtime/ds160-server-package/requirements.txt"

python -m pip install \
  flask \
  flask-cors \
  gunicorn \
  openpyxl \
  pandas \
  playwright \
  psutil \
  requests \
  pillow

echo "[4/5] Installing Playwright Chromium"
python -m playwright install chromium

echo "[5/5] Preparing DS-160 runtime assets"
python "${ROOT_DIR}/scripts/setup-us-visa.py"

echo
echo "Server Python environment is ready."
echo "Activate it with:"
echo "  source ${VENV_DIR}/bin/activate"
