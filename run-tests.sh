#!/bin/bash



CONTAINER=$(docker ps -q --filter "label=com.docker.compose.service=indexer")
if [ "$1" == "--install" ] ; then
    docker exec -it $CONTAINER npm install && npm run test 
else
    docker exec -it $CONTAINER npm run test 
fi