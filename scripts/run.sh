#!/usr/bin/env bash
. venv/bin/activate
. /home/ec2-user/config.sh
python server_images.py
uvicorn main:app --port 8080 --host 127.0.0.1
