#!/usr/bin/env bash
. venv/bin/activate
. /home/ec2-user/config.sh
python server_images.py
python updater.py
