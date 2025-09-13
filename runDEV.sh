#!/bin/bash

echo "Running runDEV.sh..."
echo $APP_ENV

cp .env.dev .env

node index.js