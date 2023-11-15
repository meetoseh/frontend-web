# publishes the updates:frontend-web:build_ready message on redis. In theory we could
# do this with the redis-cli, but it's easier to do it in python
inform_instances() {
    cd /usr/local/src/webapp
    if [ ! -d venv ]
    then
        python3 -m venv venv
    fi
    . venv/bin/activate
    . /home/ec2-user/config.sh
    
    python -m pip install -U pip
    pip install -r requirements.txt
    python on_build_ready.py
}

inform_instances