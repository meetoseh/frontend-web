# compresses build/ to build.tar.gz
compress_code() {
    cd /usr/local/src/webapp
    tar -czf build.tar.gz build
}

# stores build.tar.gz in S3 under s3_files/builds/frontend/build.tar.gz
upload_code() {
    . /home/ec2-user/config.sh
    cd /usr/local/src/webapp
    aws s3 cp build.tar.gz s3://$OSEH_S3_BUCKET_NAME/builds/frontend/build.tar.gz
}

compress_code
upload_code