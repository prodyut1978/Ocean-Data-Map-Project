#!/bin/bash

url="http://lxc-on-02.ent.dfo-mpo.ca:5000"
config="/home/ubuntu/ONavScripts/profiling_scripts/api_profiling_config.json"
prof_path="/home/ubuntu/ONavScripts/profiler_results"
max_time=300
max_attempts=1
user_id="$(whoami)-$(hostname)-$(hostname -I | awk '/10/ {print $1}')-$(date -u +%Y%m%d%H%M%S)"
# add -l to suppress logfile and -c to suppress csv output

python api_profiling_driver.py --url $url --config $config --prof $prof_path --id $user_id -a $max_attempts -t $max_time
python api_profiling_plot_csv.py "${user_id}_api_profiling_results.csv" $user_id

#scp -i ${HOME}/keys/onav /$user_id*.csv profile@justin-Sky-X4.ent.dfo-mpo.ca:
