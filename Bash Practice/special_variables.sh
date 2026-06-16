#!/bin/bash

echo "$0"
# $0 is a special variable that holds the name of the script which is currently running.
# In this case, it will output the name of the script, which is "bash-practice.sh".
# Output: ./bash-practice.sh

echo "$1"
# $1 is a special variable that holds the first argument passed to the script. 
# If you run the script with an argument, for example: ./bash-practice.sh Emrul, then $1 will output "Emrul".
# Output: Emrul

echo "$2"
# $2 is a special variable that holds the second argument passed to the script. 
# If you run the script with two arguments, for example: ./bash-practice.sh Emrul Hasan, then $2 will output "Hasan".
# Output: Hasan

echo "$@"
# $@ is a special variable that holds all the arguments passed to the script as a single string. 
# If you run the script with multiple arguments, for example: ./bash-practice.sh Emrul Hasan Emon, then $@ will output "Emrul Hasan Emon".
# Output: Emrul Hasan Emon

echo "$#"
# $# is a special variable that holds the number of arguments passed to the script. 
# If you run the script with three arguments, for example: ./bash-practice.sh Emrul Hasan Emon, then $# will output "3".
# Output: 3

echo "$$"
# $$ is a special variable that holds the process ID (PID) of the currently running script. 
# When you run the script, it will output the PID of the script process.
# Output: 12345 (example PID)