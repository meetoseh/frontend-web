#!/usr/bin/env bash
install_basic_dependencies() {
    if ! rsync --help > /dev/null 2>&1
    then
        yum install -y rsync
    fi
}

install_nginx() {
    cp scripts/nginx.repo /etc/yum.repos.d/nginx.repo
    sudo -u ec2-user mkdir -p /home/ec2-user/logs

    yum clean metadata
    yum update -y
    yum install -y nginx
    sleep 1
    nginx -t && nginx
    sleep 1
    if ! nginx -s quit
    then
        echo "Failed to quit nginx, attempting to kill by process name"
        while [ -n "$(pgrep nginx)" ]
        do
            echo "Killing $(pgrep nginx | head -n 1)"
            kill $(pgrep nginx | head -n 1)
            sleep 1
        done
    fi

    while [ -n "$(pgrep nginx)" ]
    do
        echo "Waiting for nginx to shut off"
        sleep 1
    done
    echo "nginx stopped successfully"
}

install_nginx_if_necessary() {
    if [ ! -f /etc/yum.repos.d/nginx.repo ]
    then
        install_nginx
    fi
}

activate_nvm() {
    source /root/.bashrc
    source /root/.nvm/nvm.sh
}

install_nvm() {
    yum -y install build-essential libssl-dev
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash
}

install_node() {
    nvm install 18
}

activate_node_installing_if_necessary() {
    activate_nvm
    if ! command -v nvm > /dev/null 2>&1
    then
        install_nvm
        activate_nvm
    fi

    if ! command -v npm > /dev/null 2>&1
    then
        install_node
        activate_nvm
    fi
}

update_nginx_config() {
    cp scripts/nginx.conf /etc/nginx/nginx.conf
}

update_website_code() {
    if [ ! -d venv ]
    then
        python3 -m venv venv
    fi
    . venv/bin/activate
    . /home/ec2-user/config.sh
    python -m pip install -U pip
    pip install -r requirements.txt
    nvm use node
    npm install
    npm run build
    deactivate
    rsync -avu --delete build/ /var/www
}

install_basic_dependencies
install_nginx_if_necessary
activate_node_installing_if_necessary
update_nginx_config
update_website_code
