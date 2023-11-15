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

update_nginx_config() {
    cp scripts/nginx.conf /etc/nginx/nginx.conf
}

install_python_requirements() {
    cd /usr/local/src/webapp
    if [ ! -d venv ]
    then
        python3 -m venv venv
    fi
    . venv/bin/activate
    python -m pip install -U pip
    pip install -r requirements.txt
    deactivate
}

update_website_code() {
    source /home/ec2-user/config.sh
    rm -rf build/
    if ! aws s3 cp s3://$OSEH_S3_BUCKET_NAME/builds/frontend/build.tar.gz build.tar.gz
    then
        echo "Build not available, skipping"
        return
    fi
    
    tar -xzf build.tar.gz
    rsync --recursive --perms --times --checksum --group --owner --inplace --delete --delete-during --force build/ /var/www
}

install_basic_dependencies
install_nginx_if_necessary
install_python_requirements
update_nginx_config
update_website_code
