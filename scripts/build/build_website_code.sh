# Builds the website code to build/

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

update_website_code() {
    . /home/ec2-user/config.sh
    cd /usr/local/src/webapp
    nvm use node
    npm install
    npm run build
}

activate_node_installing_if_necessary
update_website_code