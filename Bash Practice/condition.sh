#!/bin/bash

# If-Else Example
echo "Enter a number: "
read num

if [ $num -gt 10 ]; then
  echo "$num is greater than 10"
elif [ $num -eq 10 ]; then
  echo "$num is equal to 10"
else
  echo "$num is less than 10"
fi

# Case Statement Example
echo ""
echo "Enter a choice (start/stop/restart): "
read choice

case $choice in
  start)
    echo "Starting service..."
    ;;
  stop)
    echo "Stopping service..."
    ;;
  restart)
    echo "Restarting service..."
    ;;
  *)
    echo "Invalid choice. Use start, stop, or restart."
    ;;
esac
