#!/bin/bash
source /root/visa-web-backend/usvisa/venv/bin/activate
export PYTHONPATH=/root/visa-web-backend
gunicorn -w 2 -b 0.0.0.0:5001 usvisa.photo_check_api:app
