#!/usr/bin/env bash

# Usage: ./runserver.sh <port> <optional_dataset_config_file.json>
# <optional_dataset_config_file.json>:  Specify a non-default dataset config file to load the Navigator with.
#                                       Argument not required.

[[ x"$1" == x"" ]] && PORT=5000 || PORT=$1

WORKER_THREADS=5

if [ ! -e /usr/bin/bc ] ; then
    NUMBER_WORKERS=$(nproc)
else
    NUMBER_WORKERS=$(echo "($(nproc) * 2)+1" | bc)
fi

gunicorn -w $((NUMBER_WORKERS)) --threads $((WORKER_THREADS)) --worker-class=gthread -t 300 --graceful-timeout 300 --preload -b 0.0.0.0:$((PORT)) --reload "oceannavigator:create_app()" $2
