#!/bin/bash

firstName="Emrul"
lastName="Hasan Emon"

# Operation 1: String concatenation
fullName="$firstName $lastName"
echo "My full name is: $fullName"

# Output: My full name is: Emrul Hasan Emon

# READING VALUES FROM USER
echo "Enter your first name: "
read firstName
echo "Enter your last name: "
read lastName

# String concatenation
fullName="$firstName $lastName"
echo "My full name is: $fullName"

# Operation 2: String length
nameLength=${#fullName}
echo "The length of my full name is: $nameLength"
# Output: The length of my full name is: 17

# Operation 3: Substring extraction
firstNameSubstring=${fullName:0:6}
echo "The first name extracted from full name is: $firstNameSubstring"
# Output: The first name extracted from full name is: Emrul