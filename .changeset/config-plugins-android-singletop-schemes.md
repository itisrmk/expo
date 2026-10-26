---
'@expo/config-plugins': patch
---

Read and update Android URI schemes when `MainActivity` uses `android:launchMode="singleTop"`. `expo run:android` and `expo start --dev-client` can open the dev client with the project URL.
