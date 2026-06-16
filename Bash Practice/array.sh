#!/bin/bash

declare -a myArray=("Emrul" "Hasan" "Emon")

echo "First element: ${myArray[0]}"
# Output: First element: Emrul

echo "Second element: ${myArray[1]}"
# Output: Second element: Hasan

echo "Third element: ${myArray[2]}"
# Output: Third element: Emon

# LOOP
echo "All elements in the array: "
for element in "${myArray[@]}"
do
    echo "$element"
done
# Output:
# All elements in the array:
# Emrul
# Hasan
# Emon