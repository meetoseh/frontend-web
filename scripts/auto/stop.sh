#!/usr/bin/env bash
screen -S webapp -X stuff "^C"
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

stop_updater() {
  if [ -f updater.lock ]
  then
      echo "Updater.lock still exists, giving it another 5 seconds"
      local ctr=0
      while [ -f updater.lock ]
      do
          sleep 1
          ctr=$((ctr+1))
          if [ $ctr -gt 5 ]
          then
              echo "Updater is taking too long to finish, yoinking"
              rm -f updater.lock
              break
          fi
      done
  fi
}

stop_updater()