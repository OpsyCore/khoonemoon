#!/usr/bin/env bash
set -euo pipefail
output=$(mktemp -d)
trap 'rm -rf "$output"' EXIT
javac -d "$output" android/app/src/main/java/app/khoonemoon/mobile/QuietHours.java android/tests/app/khoonemoon/mobile/QuietHoursTest.java
java -cp "$output" app.khoonemoon.mobile.QuietHoursTest
