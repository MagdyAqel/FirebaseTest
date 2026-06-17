# مشروع ملاحظاتي مع Firebase

مشروع ويب بسيط للتدرب على:

- رفع مشروع إلى GitHub.
- ربط صفحة HTML بقاعدة بيانات Firebase Firestore.
- إضافة وقراءة وحذف ملاحظات.

## تشغيل المشروع محليًا

افتح Terminal داخل مجلد المشروع ثم شغّل:

```bash
python -m http.server 5500
```

بعدها افتح:

```text
http://localhost:5500
```

إذا لم تضع إعدادات Firebase بعد، سيعمل التطبيق بوضع تجريبي باستخدام `localStorage`.

## ربط Firebase

1. افتح [Firebase Console](https://console.firebase.google.com/).
2. أنشئ مشروعًا جديدًا.
3. من صفحة المشروع اختر أيقونة الويب `</>`.
4. سجّل التطبيق وانسخ كائن `firebaseConfig`.
5. افتح ملف `firebase-config.js` واستبدل القيم التجريبية بالقيم التي نسختها.
6. من Firebase Console افتح `Firestore Database`.
7. اضغط `Create database`.
8. اختر `Test mode` أثناء التدريب فقط.
9. شغّل المشروع وأضف ملاحظة، ثم راقب ظهورها في مجموعة `notes`.

## رفع المشروع إلى GitHub

نفذ الأوامر التالية من داخل مجلد المشروع:

```bash
git init
git add .
git commit -m "Create Firebase notes app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/firebase-notes.git
git push -u origin main
```

استبدل `YOUR_USERNAME` باسم حسابك في GitHub.

## ملاحظة أمان

إعدادات Firebase في تطبيقات الويب ليست سرية مثل كلمات المرور، لكنها يجب أن تكون محمية بقواعد Firestore. لا تترك `Test mode` في مشروع حقيقي.
