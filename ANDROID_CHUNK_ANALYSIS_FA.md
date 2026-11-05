# گزارش بررسی chunkهای Android WebView

این گزارش از build تولیدی با URL و کلید عمومی پروژه تولید شده است. حجم‌ها بایت هستند. ستون وابستگی‌ها importهای JavaScript قابل‌مشاهده را نشان می‌دهد: S وابستگی static و D وابستگی dynamic. وابستگی‌های CSS و تصاویر در این جدول JS لحاظ نشده‌اند. هر chunk gzip جداگانه شده است. نام‌های hash با هر build ممکن است عوض شوند.

## مقایسه

| معیار | قبل (900a38b) | بعد |
|---|---:|---:|
| تعداد chunkهای JS در assets | 31 | 19 |
| Initial JS، gzip | 177,713 | 177,479 |
| Total JS، gzip | 306,521 | 304,191 |

Initial فقط closure importهای static از entry است. Total مجموع تمام JSهای assets است، نه حجم APK؛ sw.js شامل آن نیست. کل صفحه‌ها در Initial بارگذاری نمی‌شوند. زمان اجرا و حافظه روی دستگاه اندازه‌گیری نشده است.

## تحلیل

- قبل از گروه‌بندی ۱۳ chunk آیکون کوچک از ۱۶۷ تا ۲۹۸ بایت gzip بود. gzip جداگانه، هدر فایل، import و نام فایل بازده فشرده‌سازی را کاهش می‌دهد. آن‌ها در chunk مشترک deferred-icons ادغام شدند. گروه‌بندی فقط این آیکون‌ها را دربر می‌گیرد و در صورت استفاده آینده از آن‌ها در entry ممکن است Initial تغییر کند؛ budget اولیه این موضوع را آشکار می‌کند.
- Calendar، Finance، Documents و سایر صفحه‌ها مستقل باقی مانده‌اند. برای مقایسه، ادغام دو فرم تسک و رویداد Total را به ۳۰۲٬۵۳۵ بایت رساند، اما بازکردن هر فرم نیازمند کد فرم دیگر نیز می‌شد؛ برای حفظ تفکیک پذیرفته نشد. گروه‌بندی همه آیکون‌ها Initial را به ۱۸۱٬۸۴۲ بایت رساند و رد شد؛ نسخه حاضر فقط آیکون‌های کوچکِ deferred را گروه می‌کند.
- تحلیل sourcemap build پس از تغییر هیچ فایل منبع تکراری React، React DOM، Supabase، Temporal، Zod یا Lucide را در چند chunk گزارش نکرد. این بررسی به نگاشت sourcemap محدود است و اثبات یکتایی هر helper تولیدشده یا نبود نسخه‌های متفاوت یک کتابخانه نیست. React، Supabase و Zod برای شروع/احراز هویت همچنان در مسیر اولیه هستند؛ Temporal در chunk Calendar است.
- سقف Total همان ۲۸۴٬۰۰۰ بایت باقی مانده و در build تولیدی ۲۰٬۱۹۱ بایت رد شده است. سقف Initial جدید ۱۹۰٬۰۰۰ بایت است: این حد درخواست‌شده و نگهبان رگرسیون حجم است، نه تضمین سرعت دستگاه؛ حدود ۱۲٫۳ کیلوبایت ده‌دهی حاشیه نسبت به قبل دارد. هیچ سقف Total تغییر نکرده است.
- trade-off: بازشدن صفحه‌ها ممکن است chunk آیکون مشترک را هم بارگذاری کند. Android assetها را محلی می‌خواند؛ نسخه وب مستقل service worker را برای precache همه chunkها دارد، بنابراین صرف lazy بودن به معنی کاهش کل دانلود پس‌زمینه وب نیست.

## همه chunkها قبل از گروه‌بندی

| نام | خام | gzip | وابستگی‌ها |
|---|---:|---:|---|
| `browser-push-settings-FPnQzJZ4.js` | 2,031 | 1,100 | S: `jsx-runtime-Btb1Lqfl.js`<br>S: `index-DPF31yg_.js` |
| `calendar-DsTWDmAl.js` | 176,019 | 51,040 | S: `jsx-runtime-Btb1Lqfl.js`<br>S: `jalali-CO6KO1kr.js`<br>S: `circle-dollar-sign-WFylgrer.js`<br>S: `map-pin-BOj3NAkl.js`<br>S: `plus-CbUHoBGI.js`<br>S: `shopping-cart-DQrmuP31.js`<br>S: `square-check-DXjao_CU.js`<br>S: `users-round-CeG_Pvr_.js`<br>S: `index-DPF31yg_.js` |
| `chores-dashboard-BwwtKahU.js` | 12,878 | 4,627 | S: `jsx-runtime-Btb1Lqfl.js`<br>S: `clock-3-DFjpxOL4.js`<br>S: `heart-BiMHxoKD.js`<br>S: `plus-CbUHoBGI.js`<br>S: `refresh-cw-D8dw_Tb1.js`<br>S: `square-check-DXjao_CU.js`<br>S: `sun-__LmTn0v.js`<br>S: `index-DPF31yg_.js` |
| `circle-dollar-sign-WFylgrer.js` | 278 | 225 | S: `index-DPF31yg_.js` |
| `clock-3-DFjpxOL4.js` | 199 | 184 | S: `index-DPF31yg_.js` |
| `direct-client-qsvNW8K5.js` | 21,507 | 9,137 | — |
| `documents-Ctcoi27a.js` | 20,444 | 6,315 | S: `jsx-runtime-Btb1Lqfl.js`<br>S: `plus-CbUHoBGI.js`<br>S: `users-round-CeG_Pvr_.js`<br>S: `index-DPF31yg_.js` |
| `ellipsis-BI5Ihohf.js` | 284 | 201 | S: `index-DPF31yg_.js` |
| `export-D81yHebf.js` | 33,510 | 9,087 | S: `jsx-runtime-Btb1Lqfl.js`<br>S: `direct-client-qsvNW8K5.js` |
| `finance-BOWaC_p_.js` | 33,554 | 10,386 | S: `jsx-runtime-Btb1Lqfl.js`<br>S: `circle-dollar-sign-WFylgrer.js`<br>S: `ellipsis-BI5Ihohf.js`<br>S: `heart-BiMHxoKD.js`<br>S: `plus-CbUHoBGI.js`<br>S: `shopping-basket-1Jl437uD.js`<br>S: `index-DPF31yg_.js` |
| `heart-BiMHxoKD.js` | 288 | 236 | S: `index-DPF31yg_.js` |
| `home-dashboard-evXSnpet.js` | 14,066 | 4,442 | S: `jsx-runtime-Btb1Lqfl.js`<br>S: `heart-BiMHxoKD.js`<br>S: `plus-CbUHoBGI.js`<br>S: `square-check-DXjao_CU.js`<br>S: `users-round-CeG_Pvr_.js`<br>S: `index-DPF31yg_.js` |
| `index-DPF31yg_.js` | 625,648 | 174,500 | S: `jsx-runtime-Btb1Lqfl.js`<br>D: `documents-Ctcoi27a.js`<br>D: `reminders-Dx4Spsq6.js`<br>D: `shopping-COmLDErA.js`<br>D: `search-Cg7R5cPc.js`<br>D: `export-D81yHebf.js`<br>D: `calendar-DsTWDmAl.js`<br>D: `new-task-BziZ5Myf.js`<br>D: `new-event-DXXVDW0s.js`<br>D: `finance-BOWaC_p_.js`<br>D: `chores-dashboard-BwwtKahU.js`<br>D: `profile-CHpCRQBw.js`<br>D: `home-dashboard-evXSnpet.js`<br>D: `settings-DiLVtf4w.js` |
| `jalali-CO6KO1kr.js` | 1,849 | 788 | S: `index-DPF31yg_.js` |
| `jsx-runtime-Btb1Lqfl.js` | 8,440 | 3,213 | — |
| `map-pin-BOj3NAkl.js` | 289 | 243 | S: `index-DPF31yg_.js` |
| `new-event-DXXVDW0s.js` | 10,252 | 3,515 | S: `jsx-runtime-Btb1Lqfl.js`<br>S: `jalali-CO6KO1kr.js`<br>S: `clock-3-DFjpxOL4.js`<br>S: `map-pin-BOj3NAkl.js`<br>S: `users-B850Avpo.js`<br>S: `index-DPF31yg_.js` |
| `new-task-BziZ5Myf.js` | 11,799 | 4,185 | S: `jsx-runtime-Btb1Lqfl.js`<br>S: `jalali-CO6KO1kr.js`<br>S: `clock-3-DFjpxOL4.js`<br>S: `refresh-cw-D8dw_Tb1.js`<br>S: `sun-__LmTn0v.js`<br>S: `users-B850Avpo.js`<br>S: `index-DPF31yg_.js` |
| `plus-CbUHoBGI.js` | 183 | 167 | S: `index-DPF31yg_.js` |
| `profile-CHpCRQBw.js` | 4,773 | 1,976 | S: `jsx-runtime-Btb1Lqfl.js`<br>S: `index-DPF31yg_.js` |
| `refresh-cw-D8dw_Tb1.js` | 351 | 247 | S: `index-DPF31yg_.js` |
| `reminders-Dx4Spsq6.js` | 17,402 | 5,700 | S: `jsx-runtime-Btb1Lqfl.js`<br>S: `ellipsis-BI5Ihohf.js`<br>S: `plus-CbUHoBGI.js`<br>S: `index-DPF31yg_.js`<br>S: `browser-push-settings-FPnQzJZ4.js` |
| `search-Cg7R5cPc.js` | 10,960 | 4,333 | S: `jsx-runtime-Btb1Lqfl.js`<br>S: `clock-3-DFjpxOL4.js`<br>S: `shopping-cart-DQrmuP31.js`<br>S: `index-DPF31yg_.js` |
| `settings-DiLVtf4w.js` | 15,006 | 4,826 | S: `jsx-runtime-Btb1Lqfl.js`<br>S: `clock-3-DFjpxOL4.js`<br>S: `sun-__LmTn0v.js`<br>S: `users-B850Avpo.js`<br>S: `index-DPF31yg_.js`<br>S: `direct-client-qsvNW8K5.js`<br>S: `browser-push-settings-FPnQzJZ4.js` |
| `shopping-COmLDErA.js` | 13,280 | 4,288 | S: `jsx-runtime-Btb1Lqfl.js`<br>S: `ellipsis-BI5Ihohf.js`<br>S: `plus-CbUHoBGI.js`<br>S: `shopping-basket-1Jl437uD.js`<br>S: `index-DPF31yg_.js` |
| `shopping-basket-1Jl437uD.js` | 440 | 275 | S: `index-DPF31yg_.js` |
| `shopping-cart-DQrmuP31.js` | 419 | 298 | S: `index-DPF31yg_.js` |
| `square-check-DXjao_CU.js` | 257 | 222 | S: `index-DPF31yg_.js` |
| `sun-__LmTn0v.js` | 502 | 276 | S: `index-DPF31yg_.js` |
| `users-B850Avpo.js` | 336 | 242 | S: `index-DPF31yg_.js` |
| `users-round-CeG_Pvr_.js` | 303 | 247 | S: `index-DPF31yg_.js` |

## همه chunkها بعد از گروه‌بندی

| نام | خام | gzip | وابستگی‌ها |
|---|---:|---:|---|
| `browser-push-settings-UJm0px9a.js` | 2,031 | 1,098 | S: `jsx-runtime-Btb1Lqfl.js`<br>S: `index-DrDugzUz.js` |
| `calendar-C4OyAsMS.js` | 175,828 | 50,958 | S: `jsx-runtime-Btb1Lqfl.js`<br>S: `jalali-DCzBRzE7.js`<br>S: `deferred-icons-BP5i3OYj.js`<br>S: `index-DrDugzUz.js` |
| `chores-dashboard-JKT64nVQ.js` | 12,706 | 4,553 | S: `jsx-runtime-Btb1Lqfl.js`<br>S: `deferred-icons-BP5i3OYj.js`<br>S: `index-DrDugzUz.js` |
| `deferred-icons-BP5i3OYj.js` | 3,493 | 1,380 | S: `index-DrDugzUz.js` |
| `direct-client-qsvNW8K5.js` | 21,507 | 9,137 | — |
| `documents-CQA-e88Q.js` | 20,415 | 6,305 | S: `jsx-runtime-Btb1Lqfl.js`<br>S: `deferred-icons-BP5i3OYj.js`<br>S: `index-DrDugzUz.js` |
| `export-D81yHebf.js` | 33,510 | 9,087 | S: `jsx-runtime-Btb1Lqfl.js`<br>S: `direct-client-qsvNW8K5.js` |
| `finance-CXVH_4cJ.js` | 33,406 | 10,319 | S: `jsx-runtime-Btb1Lqfl.js`<br>S: `deferred-icons-BP5i3OYj.js`<br>S: `index-DrDugzUz.js` |
| `home-dashboard-CYFOMGqr.js` | 13,964 | 4,398 | S: `jsx-runtime-Btb1Lqfl.js`<br>S: `deferred-icons-BP5i3OYj.js`<br>S: `index-DrDugzUz.js` |
| `index-DrDugzUz.js` | 625,253 | 174,266 | S: `jsx-runtime-Btb1Lqfl.js`<br>D: `documents-CQA-e88Q.js`<br>D: `reminders-DW9ZDY9T.js`<br>D: `shopping-CBOitQil.js`<br>D: `search-D71KF7mj.js`<br>D: `export-D81yHebf.js`<br>D: `calendar-C4OyAsMS.js`<br>D: `new-task-Bo-NXEcX.js`<br>D: `new-event-BoCWu2ym.js`<br>D: `finance-CXVH_4cJ.js`<br>D: `chores-dashboard-JKT64nVQ.js`<br>D: `profile-BRbA460O.js`<br>D: `home-dashboard-CYFOMGqr.js`<br>D: `settings-DZ81oaqk.js` |
| `jalali-DCzBRzE7.js` | 1,849 | 788 | S: `index-DrDugzUz.js` |
| `jsx-runtime-Btb1Lqfl.js` | 8,440 | 3,213 | — |
| `new-event-BoCWu2ym.js` | 10,191 | 3,491 | S: `jsx-runtime-Btb1Lqfl.js`<br>S: `jalali-DCzBRzE7.js`<br>S: `deferred-icons-BP5i3OYj.js`<br>S: `index-DrDugzUz.js` |
| `new-task-Bo-NXEcX.js` | 11,704 | 4,146 | S: `jsx-runtime-Btb1Lqfl.js`<br>S: `jalali-DCzBRzE7.js`<br>S: `deferred-icons-BP5i3OYj.js`<br>S: `index-DrDugzUz.js` |
| `profile-BRbA460O.js` | 4,773 | 1,976 | S: `jsx-runtime-Btb1Lqfl.js`<br>S: `index-DrDugzUz.js` |
| `reminders-DW9ZDY9T.js` | 17,376 | 5,690 | S: `jsx-runtime-Btb1Lqfl.js`<br>S: `deferred-icons-BP5i3OYj.js`<br>S: `index-DrDugzUz.js`<br>S: `browser-push-settings-UJm0px9a.js` |
| `search-D71KF7mj.js` | 10,926 | 4,321 | S: `jsx-runtime-Btb1Lqfl.js`<br>S: `deferred-icons-BP5i3OYj.js`<br>S: `index-DrDugzUz.js` |
| `settings-DZ81oaqk.js` | 14,944 | 4,802 | S: `jsx-runtime-Btb1Lqfl.js`<br>S: `deferred-icons-BP5i3OYj.js`<br>S: `index-DrDugzUz.js`<br>S: `direct-client-qsvNW8K5.js`<br>S: `browser-push-settings-UJm0px9a.js` |
| `shopping-CBOitQil.js` | 13,211 | 4,263 | S: `jsx-runtime-Btb1Lqfl.js`<br>S: `deferred-icons-BP5i3OYj.js`<br>S: `index-DrDugzUz.js` |
