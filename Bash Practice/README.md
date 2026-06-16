# Bash Scripts

## How to Run

1. **Make the script executable:**
   ```bash
   chmod +x bash_file_name
   ```

   Example:
   ```bash
   chmod +x bash-practice.sh
   ```

2. **Run the script:**
   ```bash
   ./bash_file_name
   ```

   Example:
   ```bash
   ./bash-practice.sh
   ```

## Variables

There are three types of variables:

- **User Defined** — created by the user
- **System Variables** — predefined by the system (e.g. `$HOME`, `$USER`)
- **Special Variables** — built-in context variables (e.g. `$0`, `$1`, `$@`)
- **Arrays** — indexed collections (e.g. `fruits=('apple' 'banana')`)

## Loops

### For Loop

```bash
for var in list; do
  # commands
done
```

Example:
```bash
for i in {1..5}; do
  echo "Number: $i"
done
```

### While Loop

```bash
while [ condition ]; do
  # commands
done
```

Example:
```bash
count=1
while [ $count -le 5 ]; do
  echo "Count: $count"
  ((count++))
done
```

> **Difference:**
> - `while` — runs **as long as** the condition is **true**. Stops when condition becomes false.
> - `until` — runs **as long as** the condition is **false**. Stops when condition becomes true.
>
> In short, they are opposites:
> - `while [ $count -le 5 ]` → runs **while** count ≤ 5  (i.e., count is 1,2,3,4,5)
> - `until [ $count -gt 5 ]` → runs **until** count > 5  (i.e., count is 1,2,3,4,5) — same result, opposite condition

### Until Loop

```bash
until [ condition ]; do
  # commands
done
```

Example:
```bash
count=1
until [ $count -gt 5 ]; do
  echo "Count: $count"
  ((count++))
done
```
