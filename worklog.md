
---
Task ID: 6
Agent: Super Z (main)
Task: Добавление системы абонементов (запрос пользователя от 2026-09-04)

Work Log:
- Скачал архив проекта с Яндекс.Диска (englishpro-fixed.tar.gz), распаковал и перенёс в /home/z/my-project (Next.js 16 + Zustand persist + localStorage).
- Изучил архитектуру: клиентское приложение без БД, стор Zustand (ep-store.ts), типы (ep-types.ts), карточки учеников (ep-students.tsx), модалки через activeModal в ep-layout.tsx.
- ep-types.ts: добавил интерфейс Subscription (id, studentId, totalLessons, usedLessons, startDate, endDate, price, frozen, createdAt), тип SubscriptionStatus, поле Lesson.subscriptionDeductions[].
- Новый модуль src/lib/ep-subscriptions.ts: todayStr, diffDays, getSubStatus, getActiveSubscription (для списания), getDisplaySubscription (для карточки), subLessonsLeft/DaysTotal/DaysLeft, subScaleColor (цветовая шкала), fmtDateDMY, sortSubsForList, SUB_STATUS_LABELS.
- ep-store.ts: состояние subscriptions[], действия addSubscription (проверка баланса, списание цены, финансовая запись «Покупка абонемента»), updateSubscription (total >= used, start <= end), toggleFreezeSubscription, deleteSubscription (пропорциональный возврат за неиспользованные занятия + запись «Возврат за абонемент»); изменение changeLessonStatus, completeLessonWithAttendance, cancelLessonWithPenalty: разделение учеников на «по абонементу» и «с баланса», списание 1 занятия с активного абонемента, фиксация subscriptionDeductions для корректного отката, возврат занятия при сбросе/отмене проведённого урока; deleteStudent/deleteStudentKeepLessons удаляют абонементы; subscriptions добавлены в partialize persist.
- Новый компонент ep-subscription-modal.tsx: список всех абонементов с бейджами статусов (Активен/Будущий/Заморожен/Недействителен), мини-шкалой и действиями (редактировать/заморозить/удалить), форма создания (пресеты 4/8/12/16, даты, цена по умолчанию rate×занятия, предпросмотр списания, блокировка при недостатке средств) и форма редактирования (цена только для чтения, min занят = использовано).
- ep-layout.tsx: зарегистрировал модалку 'subscription' + aria-label.
- ep-students.tsx: иконка fa-ticket «Абонемент» рядом с балансом/редактированием/архивом/удалением; блок текущего абонемента на карточке: заголовок + бейдж статуса, дни справа над шкалой («30 из 30 дней»), шкала с цветом по остатку, слева под шкалой «7 из 8 занятий», справа период «04.09.2026 — 04.10.2026».
- ep-attendance-modal.tsx: подсказка «По абонементу спишется: N», «Итого к оплате» учитывает только оплату с баланса; исправил conditional useState (pre-existing lint).
- ep-settings.tsx: экспорт/импорт/очистка данных включают subscriptions.
- Исправил pre-existing lint/tsc ошибки: ep-app.tsx (setState в useEffect → useSyncExternalStore), ep-balance-modal.tsx (useMemo deps), ep-finance.tsx (типизация массивов), ep-utils.ts (pricePerLesson в демо-данных).
- Lint: 0 ошибок. tsc: чисто (по файлам приложения).
- Браузерная проверка (agent-browser): регистрация → создание ученика (баланс 20000) → создание абонемента 8 занятий/12000 (баланс 8000) → шкала на карточке «30 из 30», «8 из 8», период → проведение урока: тост «Занятие списано с абонемента», шкала 7 из 8, баланс не изменился → создание будущего абонемента (старт завтра, списалось 6000, баланс 2000, на карточке не виден) → недостаточно средств: кнопка disabled с предупреждением → заморозка: статус «Заморожен» на карточке, разморозка возвращает «Активен» → второй урок: 6 из 8, будущий не тронут → редактирование total до 2 (=used): «Недействителен», красная шкала rgb(255,92,92), не удалён автоматически → урок без активного абонемента: списание с баланса 2000→500 → смена даты начала будущего на сегодня: автоактивация («Активен», 4 из 4) → удаление недействительного (возврат 0) и активного (возврат 6000, баланс 500+6000=6500). Все сценарии ТЗ подтверждены.

Stage Summary:
- Система абонементов полностью реализована по 4 блокам ТЗ: создание/управление, отображение на карточке со шкалой, будущие абонементы с автоактивацией, списание занятий.
- Новые файлы: src/lib/ep-subscriptions.ts, src/components/ep-subscription-modal.tsx.
- Изменённые: ep-types.ts, ep-store.ts, ep-layout.tsx, ep-students.tsx, ep-attendance-modal.tsx, ep-settings.tsx, ep-app.tsx, ep-balance-modal.tsx, ep-finance.tsx, ep-utils.ts.
- Данные хранятся в localStorage (zustand persist), абонементы включены в экспорт/импорт.

---
Task ID: 7
Agent: Super Z (main)
Task: Выдать пользователю файл проекта для скачивания («дай файл для скачивания»)

Work Log:
- Проверил, что реализация абонементов из Task 6 на месте (ep-subscriptions.ts, ep-subscription-modal.tsx и правки в store/types/students/layout).
- Прогнал tsc --noEmit: ошибки только в служебных examples/ и skills/ (pre-existing), код приложения чистый.
- Создал README с инструкцией по запуску и описанием функционала абонементов (внутри архива — как README.md).
- Собрал архив download/englishpro-with-abonements.tar.gz (112 файлов): весь исходный код + README, без node_modules/.next/.git/.env; внутри распаковывается в папку englishpro-with-abonements/.

Stage Summary:
- Готовый к скачиванию архив: /home/z/my-project/download/englishpro-with-abonements.tar.gz
- Также в download/ лежит subscription-card.png (скриншот карточки с абонементом).

---
Task ID: 9
Agent: Super Z (main)
Task: 2 доработки (запрос пользователя): запрет пересечения активных абонементов + социальные сети в карточке ученика

Work Log:
- ep-types.ts: новые типы SocialNetwork ('vk'|'telegram'|'max'), StudentSocials; Student.socials.
- Новый src/lib/ep-socials.ts: метаданные сетей (ВКонтакте fa-vk #0077ff, Telegram fa-telegram #2aabee, MAX — бейдж «M» #8b7cf6), паттерны валидации (vk.com|vkontakte.ru, t.me|telegram.me с поддержкой +invite, max.ru), validateSocialUrl с нормализацией https:// и русскими подсказками с примером.
- ep-subscriptions.ts: findOverlappingSubscription(subs, studentId, start, end, excludeId?) — пересечение периодов включительно (start1<=end2 && start2<=end1); учитываются активные/замороженные/будущие, НЕ учитываются архивные, исчерпанные и истёкшие.
- ep-store.ts: addSubscription/updateSubscription возвращают {ok:false, message:'Невозможно создать/изменить абонемент: новый период пересекается с текущим активным абонементом (ДД.ММ.ГГГГ — ДД.ММ.ГГГГ).'}; новое действие setStudentSocial (сохранение/удаление ссылки, тосты) и checkSubscriptionOverlap (для форм).
- ep-subscription-modal.tsx: живая проверка пересечения в SubForm — красный блок с текстом ошибки сразу при пересечении периодов, canSubmit блокирует сохранение; store дублирует защиту.
- Новый src/components/ep-socials.tsx: StudentSocialsBlock на карточке ученика — 3 строки (сеть: ссылка-линк, открыть в новой вкладке, изменить, удалить; для пустых — «+ Добавить»), инлайн-редактирование с Enter/Esc, валидация с подсказкой; disabled при selectMode/архиве ученика.
- ep-students.tsx: блок соцсетей встроен после блока ставок; props-тип расширен socials.
- tsc --noEmit чисто (кроме pre-existing examples//skills/), ESLint 0 ошибок.
- Браузерная проверка (agent-browser): регистрация → ученик Анна (баланс 3000); ВК: «некорректная ссылка!» → ошибка «Некорректная ссылка ВКонтакте. Пример: https://vk.com/username»; vk.com/anna_smirnova → сохранено как https://vk.com/anna_smirnova; t.me/anna_english и max.ru/u/87654321 добавлены (Enter тоже работает); href корректные; после reload ссылки на месте; редактирование ВК → vk.com/id777123; удаление MAX → «+ Добавить». Абонементы: создан активный 09.09–09.10; форма создания по умолчанию сразу показывает «Невозможно создать абонемент: новый период пересекается с текущим активным абонементом (09.09.2026 — 09.10.2026)», кнопка disabled; даты 10.10–09.11 → создание разрешено (будущий); редактирование будущего на 05.10 → ошибка пересечения; граничный случай старт 09.10 (= последний день активного) → заблокировано; возврат 10.10 → сохранение ОК. Ошибок консоли нет.
- README обновлён (разделы 7 и 8), пересобран архив download/englishpro-with-abonements.tar.gz (126 файлов, без skills/examples/tests/db/tool-results; PROJECT-README.md → README.md через tar --transform).

Stage Summary:
- Оба новых требования реализованы и проверены в браузере.
- Новые файлы: src/lib/ep-socials.ts, src/components/ep-socials.tsx.
- Изменённые: ep-types.ts, ep-subscriptions.ts, ep-store.ts, ep-subscription-modal.tsx, ep-students.tsx.
- Архив: /home/z/my-project/download/englishpro-with-abonements.tar.gz
- Скриншоты: download/socials-empty.png, download/socials-filled.png, download/overlap-error.png

---
Task ID: 8
Agent: Super Z (main)
Task: 4 доработки абонементов (запрос пользователя): покупка в минус, архив, списание без предупреждений, ручное списание с баланса

Work Log:
- ep-types.ts: Subscription.archived, Lesson.balanceCharge, SubscriptionStatus + 'archived'.
- ep-subscriptions.ts: getSubStatus возвращает 'archived'; SUB_STATUS_LABELS.archived='Архив'; getActiveSubscription/getDisplaySubscription фильтруют архивные; sortSubsForList — архив в конце.
- ep-store.ts:
  * addSubscription: убрана блокировка при нехватке средств (баланс уходит в минус, тост «Баланс стал отрицательным»); авто-архив предыдущих недействительных абонементов ученика при создании нового (тост).
  * Новые действия archiveSubscription / unarchiveSubscription.
  * toggleFreezeSubscription: запрет заморозки архивных.
  * changeLessonStatus(id, status, opts?: { manualChargeAmount }): ветка ручного списания — проведение индивидуального урока с оплатой с баланса на указанную сумму без расхода абонемента (финансовая запись «Оплата за урок (ручное списание)»); откат completed возвращает lesson.balanceCharge ?? price; balanceCharge очищается при сбросе/отмене.
  * cancelLessonWithPenalty: возврат balanceCharge ?? price; фильтр архивных в fallback-поиске абонемента.
- ep-subscription-modal.tsx: покупка разблокирована при любом балансе (предупреждение «баланс станет отрицательным» вместо блокировки); бейдж «Архив» (серый); кнопка «В архив» для недействительных; «Вернуть из архива» + удаление для архивных.
- НОВЫЙ ep-balance-charge-modal.tsx: окно «Списать с баланса» — сумма по умолчанию = стоимость урока, редактируемая, предупреждение «После списания баланс станет отрицательным», подсказка про активный абонемент, кнопка «Списать и провести».
- ep-lesson-detail-modal.tsx: предупреждение о минусе показывается только ученикам без активного абонемента; кнопка «Списать с баланса» для запланированных индивидуальных уроков.
- ep-layout.tsx: зарегистрирована модалка 'balance-charge'.
- Lint 0 ошибок, tsc чисто (по файлам приложения).
- Браузерная проверка (agent-browser): покупка 12000 при балансе 3000 → создан, баланс −9000, тосты; урок с активным абонементом → БЕЗ предупреждения о балансе, списание 8→7, баланс не тронут; «Списать с баланса» → окно с суммой 1500 по умолчанию, изменил на 1000, предупреждение о минусе, абонемент остался 7 из 8, баланс −10000, доход +1000 в финансах; total=1 → «Недействителен» → «В архив» → пропал с карточки → «Вернуть из архива» → снова недействителен; создание нового абонемента → авто-архив старого (тост); сброс урока с ручным списанием → возврат ровно 1000 (не 1500). Ошибок в консоли нет.
- Пересобран архив download/englishpro-with-abonements.tar.gz (115 файлов) с обновлённым README.

Stage Summary:
- Все 4 требования реализованы и проверены в браузере.
- Новые файлы: src/components/ep-balance-charge-modal.tsx.
- Изменённые: ep-types.ts, ep-subscriptions.ts, ep-store.ts, ep-subscription-modal.tsx, ep-lesson-detail-modal.tsx, ep-layout.tsx.
- Архив: /home/z/my-project/download/englishpro-with-abonements.tar.gz

---
Task ID: 10
Agent: Super Z (main)
Task: Доступ к приложению с телефона и других устройств через интернет (Backend + БД + синхронизация)

Work Log:
- Контекст: данные жили только в localStorage → на другом устройстве приложение пустое. Реализован полноценный Backend.
- prisma/schema.prisma (переписана): User (email unique, name, passwordHash, photo), Session (токен, expiresAt, idx userId), UserData (JSON-снапшот данных на пользователя, updatedAt); Post (мусорная) удалена; bun run db:push OK, Prisma Client 6.19.2.
- src/lib/ep-server-auth.ts (новый): scrypt-хеширование паролей (salt:hash, timingSafeEqual), сессии — 256-битный токен в БД + httpOnly/SameSite=Lax cookie ep_session на 30 дней, getSessionUser/destroySession.
- API-роуты (новые): /api/auth/register|login|logout|me|profile|change-password, /api/data (GET снапшота / PUT autosave, лимит 12 МБ, upsert). Валидации: email/пароль ≥4, уникальность email (409), фото ≤3 МБ data:image.
- src/lib/ep-sync.ts (новый, клиентский sync-движок): collectData/applyData; pullData (GET) и pushData (PUT, защита от параллельных запросов); schedulePush (дебаунс 700 мс) по подписке store.subscribe только на поля данных; initSync: visibilitychange → pull при отсутствии несохранённых изменений, online/offline события; useSyncStore (status idle/saving/synced/error, lastSyncAt, error, online).
- Миграция старых локальных данных: captureLegacyEarly() на уровне модуля ep-store ДО создания store (persist-гидрация сразу переписывает storage в v1 и затирает users[] — поздний захват терял emails; баг найден браузерным тестом и исправлен); автоперенос при login И register при совпадении email (тост «Локальные данные перенесены на сервер»); иначе clearLocalDataWithBackup(): stash в 'englishpro-legacy-backup' + восстановление из настроек.
- ep-store.ts: users[] удалены; authChecked; initAuth (проверка /api/auth/me + pullData); login/register/logout/changePassword/updateCurrentUser → async через API ({ok,error}); persist: version 1 + migrate (удаляет currentUser/users), partialize — только данные + theme + settings (офлайн-кэш).
- UI: ep-app.tsx (splash «Загрузка…» до authChecked, initSync в useEffect); ep-auth.tsx (async с pending-состоянием и инлайн-ошибкой role=alert, подсказка про сервер); ep-settings.tsx (карточка «Синхронизация»: статус + «Обновить» (push+pull), «Доступ с любых устройств», восстановление резервной копии браузера; профиль/пароль через API с обработкой ошибок сервера; export без users; import сохраняет на сервер); ep-sidebar.tsx (SyncIndicator «Сохранено · ЧЧ:ММ» в футере, async logout).
- PWA: public/manifest.json (standalone, #080b12), scripts/gen-icons.js (sharp → icon-192/512 + maskable-512, «EP» в круге), layout.tsx: metadata.manifest/appleWebApp/icons + viewport (viewportFit=cover, themeColor).
- Проверки: tsc --noEmit чисто, ESLint 0 ошибок.
- curl API-тесты: register→me→PUT data→GET data→login с неверным паролем (401 «Неверный email или пароль») — все корректны.
- Браузерная проверка (agent-browser): регистрация «Ольга» → ученик Анна Смирнова (баланс 10000) → в SQLite UserData появился снапшот (269 байт, содержит Анну) — autosave работает; НОВОЕ УСТРОЙСТВО: cookies+localStorage очищены → reload → login olga → ученик восстановлен с сервера, индикатор «Сохранено · 16:58»; мобильная вёрстка 390×844: бургер-меню с оверлеем, карточка ученика, модалка «Новый ученик», настройки — всё помещается; выход; неверный пароль → инлайн-ошибка; смена имени (Ольга Петрова) и пароля (1234→5678): в БД name обновлён, вход со старым паролем отклонён, с новым — ОК; МИГРАЦИЯ: подменён storage формата v0 (users[{email maria@…}], students[Легаси Ученик]) → регистрация maria@example.com → тост «Локальные данные перенесены на сервер», ученик на странице, снапшот в SQLite. Консоль/логи без ошибок; manifest.json и иконки отдаются (200).
- download/README.md + PROJECT-README.md переписаны под v2.0 (backend, доступ с телефона, деплой VPS/Railway/Vercel, архитектура, FAQ); работы оформлены в worklog.

Stage Summary:
- EnglishPro 2.0: Next.js API + Prisma/SQLite backend, серверная авторизация (scrypt + httpOnly сессии), autosave-синхронизация между устройствами, авто-миграция старых localStorage-данных, PWA-манифест с иконками, мобильная адаптация проверена.
- Новые файлы: prisma/schema.prisma (новая), src/lib/ep-server-auth.ts, src/lib/ep-sync.ts, src/app/api/auth/*/route.ts (6 шт), src/app/api/data/route.ts, public/manifest.json, public/icons/*.png, scripts/gen-icons.js, PROJECT-README.md.
- Изменённые: ep-store.ts, ep-app.tsx, ep-auth.tsx, ep-settings.tsx, ep-sidebar.tsx, src/app/layout.tsx.
- БД: db/custom.db (SQLite). Архив: download/englishpro-with-abonements.tar.gz (пересобран).

---
Task ID: 10
Agent: Super Z (main)
Task: Диагностика ошибки пользователя «не удалось зарегистрироваться» при регистрации в EnglishPro 2.0

Work Log:
- Проанализирован dev.log: ВСЕ запросы POST /api/auth/register, дошедшие до сервера, вернули 200 (успешно); неудачных (4xx/5xx) не было; последние попытки пользователя — только GET / + /api/auth/me 401 (страница открывается, но POST не доходит/не отправляется).
- Проверена гипотеза о старом архиве: в download/englishpro-with-abonements.tar.gz нет /api и формы регистрации — не источник ошибки.
- Проверен Caddyfile (простой reverse_proxy на :3000, cookies не трогает), next.config.ts, отсутствие service worker в public/.
- Найдено: db/custom.db ПУСТ (0 users/session/UserData) — БД пересоздавалась db:push в ~17:05, ранние регистрации стёрты; из-за этого повторная регистрация под тем же email не могла дать 409 в момент проверки.
- End-to-end curl-тест: register → 200 + Set-Cookie(ep_session) → me с cookie → 200 → PUT /api/data → 200. Сервер полностью исправен.
- Браузерный тест (agent-browser): регистрация через UI «Анна Тест» → тост «Аккаунт создан! Добро пожаловать!», сайдбар с профилем, 0 ошибок консоли.
- Улучшена диагностика ошибок в ep-store.ts: login/register теперь показывают код HTTP (напр. «Не удалось зарегистрироваться (код 502)»), 409 → «Этот email уже зарегистрирован. Попробуйте войти через вкладку «Вход»», сетевые сбои → «Нет соединения с сервером. Проверьте интернет и обновите страницу».
- Тест 409 через curl: «Этот email уже зарегистрирован» — корректно.
- tsc --noEmit: 0 ошибок в src/ (ошибки только в шаблонных examples/ и skills/).
- Тестовые пользователи удалены из БД (0 users), браузер закрыт.

Stage Summary:
- Сервер и UI регистрации полностью исправны; ошибка пользователя была временной/локальной (вероятные причины: сбой сети на устройстве, устаревшая открытая страница, либо попытка войти под аккаунтом, стёртым при пересоздании БД в 17:05).
- Добавлены диагностичные тексты ошибок авторизации — при повторении пользователь увидит точную причину и код.
- Пользователю отправлена инструкция: обновить страницу предпросмотра, зарегистрироваться заново; при повторе — прислать точный красный текст ошибки.

---
Task ID: 11
Agent: Super Z (main)
Task: Ошибка пользователя на Windows «@prisma/client did not initialize yet. Please run "prisma generate"» при локальном запуске

Work Log:
- Установлено: пользователь запустил проект локально на Windows (пути src\lib\db.ts в трейсе); распакованный код содержит backend, но Prisma Client не сгенерирован (после npm install), а .env в архиве отсутствовал.
- Найден скрытый фактор песочницы: в оболочке глобально экспортирован DATABASE_URL=file:/home/z/my-project/db/custom.db — dotenv не перебивает существующие env, из-за чего первые тесты «относительный путь работает» были ложными (глобальная переменная выигрывала).
- Относительный путь в .env (file:../db/custom.db) забракован: проверка во временной копии показала, что резолвинг уходит не туда (в test-копии prisma указала на БД песочницы).
- Решение: абсолютный машинно-зависимый путь, создаваемый автоматически скриптом setup (node -e пишет .env c path.resolve('db/custom.db'), backslash→slash через String.fromCharCode(92) — команда переносима между cmd/PowerShell/sh); + postinstall: prisma generate.
- package.json: добавлены "postinstall": "prisma generate" и "setup" (записать .env → generate → db push).
- ПОЛНАЯ валидация как у пользователя (env -u DATABASE_URL, свежая распаковка архива в /tmp/epsim2): bun install → npm run setup (.env создан с путём /tmp/epsim2/.../db/custom.db, БД создана там же) → npx next dev -p 3010 → GET / 200 → POST /api/auth/register 200 → юзер записан в ЛОКАЛЬНУЮ temp-БД.
- PROJECT-README.md и download/README.md: раздел «Как запустить» переписан (npm install → npm run setup → npm run dev), добавлен раздел-лечении ошибки prisma generate с командой создания .env.
- Архив download/englishpro-with-abonements.tar.gz пересобран (2.65 МБ): + .env, + postinstall/setup, + все api-маршруты (в старом архиве их не было), README актуален. Temp-каталоги очищены.
- Песочница: .env возвращён к абсолютному пути, приложение на :3000 healthy (GET / 200).

Stage Summary:
- Локальный запуск на любой ОС теперь: npm install → npm run setup → npm run dev; ошибка «prisma generate» исчезает благодаря postinstall.
- Пользователю даны 2 пути: (а) быстрые команды для существующей копии на Windows (npx prisma generate; node -e …создать .env…; npx prisma db push; npm run dev), (б) перекачать исправленный архив и npm install → npm run setup → npm run dev.

---
Task ID: 12
Agent: Super Z (main)
Task: «Делаем бэкенд» — продакшен-готовность backend EnglishPro (деплой, Docker, бэкапы, мониторинг)

Work Log:
- Уточнён статус: backend v2.0 уже работает (API auth/data, SQLite+Prisma, синхронизация устройств) — задача доведена до боевого состояния.
- package.json: start переведён с bun на node (портативность VPS), добавлен "backup": "node scripts/backup-db.mjs".
- Новый роут GET /api/health (src/app/api/health/route.ts): ping БД (SELECT 1) + latencyMs; шаблонный /api «Hello, world» удалён.
- scripts/backup-db.mjs: консистентный снимок SQLite через VACUUM INTO (безопасен при работающем сервере; fallback — копирование), папка backups/, retention BACKUP_KEEP=30; первая версия на require() переписана на ESM (.mjs) по замечанию ESLint.
- Dockerfile (multi-stage node:20-alpine: deps → build → run; standalone-выход; prisma CLI в рантайме для db push при старте; DATABASE_URL=file:/app/db/custom.db), docker-compose.yml (тома englishpro-db/englishpro-backups, healthcheck wget /api/health, restart unless-stopped), .dockerignore (db, .env, node_modules и пр. не попадают в образ).
- Тест продакшена в песочнице: npm run build ✓ (все 8 API-роутов), standalone на :3011 — /api/health {"status":"ok","db":"up"}, register/me/data PUT все 200. Инцидент отладки: старый standalone не умер → EADDRINUSE, новый падал, curl бил в старый (health 404) — найден по ss -tlp и log; после kill -9 всё зелёное.
- npm run backup проверен: englishpro-20260910-185509.db (36 КБ, VACUUM INTO).
- README: разделы «Размещение в интернете» (Docker compose / VPS / Railway-Fly-Render / Vercel+PostgreSQL) и «Мониторинг и бэкапы» (health, npm run backup, cron, восстановление).
- Тестовые юзеры из БД удалены (0 users), dev-сервер перезапущен (npm run dev, :3000, health ok).
- ESLint: health + backup — 0 ошибок; tsc src/: 0 ошибок. Архив пересобран: 643 файла, 5.3 МБ (включая Dockerfile/compose/backup/health).

Stage Summary:
- Backend EnglishPro продакшен-готов: деплой одной командой docker compose up -d --build (или npm install → setup → build → start на VPS), HTTPS через Caddy, health-check для мониторинга, бэкапы с ротацией.
- Пользователю даны 3 сценария публикации (Docker VPS / VPS+Node / PaaS) + напоминание, что превью в этой сессии уже доступно с телефона.

---
Task ID: 13
Agent: Super Z (main)
Task: Три правки UX: (1) история операций — новые сверху; (2) соцсети из карточки ученика → в редактор; (3) покупки абонементов не в расходах

Work Log:
- (1) Сортировка: найдены все 3 истории с сортировкой только по дате (b.date.localeCompare) — таблица «Операции» в ep-finance.tsx, «История операций» в ep-balance-modal.tsx и ep-student-stats-modal.tsx; внутри одной даты порядок был «старые сверху».
- Добавлен общий хелпер sortFinanceNewestFirst() в ep-utils.ts: дата по убыванию, при равных датах — по индексу в исходном массиве по убыванию (новые записи всегда добавляются в конец массива; edit/delete позицию не меняют; синк гоняет массив целиком — порядок сохраняется). Применён во всех 3 историях.
- (2) Соцсети: удалён блок StudentSocialsBlock с карточки ученика (ep-students.tsx) + подчистлены импорты/пропсы; в ep-student-modal.tsx добавлена секция «Социальные сети» (ВКонтакте/Telegram/MAX, иконки в фирменных цветах) с локальным черновиком, валидацией validateSocialUrl при сохранении (ошибки под полем + тост), нормализацией https:// и «пустое поле = удалить ссылку»; socials включён в payload addStudent/updateStudent.
- Баг в процессе: input type="url" вызывал нативную браузерную валидацию «Please enter a URL», блокировавшую сабмит до кастомной валидации (и ломавшую ввод без схемы vk.com/…) → заменён на type="text" + inputMode="url".
- (3) Расходы: в ep-types.ts добавлен TRANSFER_FINANCE_CATEGORIES = ['Покупка абонемента','Возврат за абонемент'] (внутренние переводы баланс↔абонемент, реальные деньги не двигаются); хелпер isTransferFinance() в ep-utils.ts. Фильтр применён к ДОХОДЫ/РАСХОДЫ/БАЛАНС и графикам (линия по дням/барам по месяцам/неделям + пирог «Расходы по категориям») в ep-finance.tsx и к статам месяца на ep-dashboard.tsx.
- Симметрия: «Возврат за абонемент» также исключён из доходов (иначе при удалении абонемента доход задваивался бы без соответствующего расхода).
- UX таблицы: операции-переводы получили нейтральный синий бейдж «Перевод» (badge-planned) и нейтральный цвет суммы — чтобы таблица не спорила с итогами; в истории баланса ученика покупки/возвраты остаются (там важны движения баланса).
- ep-finance-modal.tsx: при редактировании существующей операции-перевода её категория добавляется в селект (иначе селект пустел).
- Удалён мёртвый код src/components/ep-socials.tsx (компонент больше никем не импортируется; либа ep-socials.ts осталась).
- E2E-проверка в браузере (agent-browser, новый тестовый юзер): регистрация → ученик с 3 соцсетями (vk.com/… и t.me/… нормализовались в https, невалидный Telegram дал ошибку «Некорректная ссылка Telegram…», сабмит блокировался) → карточка без соцсетей → редактор открывается с заполненными ссылками → абонемент 8000 ₽: РАСХОДЫ -0 ₽, БАЛАНС +0 ₽, пирог «Нет расходов», бейдж «Перевод» в таблице → 3 операции подряд в таблице сверху новые (500 → 1000 → покупка внизу) → пополнение +5000 в «Истории операций» баланса оказалось выше покупки (обе за один день) → дашборд: Доход 6500, Расходы 0, долг -3000. 0 ошибок консоли.
- tsc --noEmit: 0 ошибок в src/; ESLint: 0 ошибок. Тестовый юзер удалён из БД (остались 2 реальных регистрации пользователя с превью 20:42/20:45 UTC — не тронуты).
- Архив download/englishpro-with-abonements.tar.gz пересобран; из старого архива убран мусор .git (был в Task 12: 643 «файла», 5.3 МБ) → чистый source-only архив 152 файла, 288 КБ; ep-socials.tsx отсутствует, .env исключён (создаётся npm run setup). Приложение на :3000 healthy после удаления файла.

Stage Summary:
- Истории операций (финансы + история баланса ученика + статистика ученика): новые операции всегда сверху, включая несколько операций за один день.
- Соцсети (VK/TG/MAX) переехали из карточки в редактор ученика: валидация, нормализация схемы, пустое поле = удаление; на карточке теперь компактнее.
- Финансовая отчётность: покупки/возвраты абонементов — «Переводы», исключены из доходов/расходов и графиков; пополнение баланса остаётся доходом. Итоги больше не искажаются внутренними движениями.

---
Task ID: 14
Agent: Super Z (main)
Task: В редакторе карточки ученика — вкладка «Родитель» (имя, почта, телефон, заметки, соцсети)

Work Log:
- Модель: ep-types.ts — новый интерфейс StudentParent { name?, email?, phone?, notes?, socials? }; Student.parent?: StudentParent; student.socials помечен @deprecated (соцсети теперь принадлежат контактам родителя).
- Миграция данных (3 точки входа, хелпер normalizeStudentsParentFields() в ep-utils.ts — перенос student.socials → parent.socials): (1) zustand persist version 1→2 + migrate в ep-store.ts; (2) extractData() в ep-sync.ts — покрывает pull с сервера и legacy-захват; (3) импорт JSON-файла в ep-settings.tsx.
- ep-store.ts: удалён мёртвый action setStudentSocial (+ импорты SocialNetwork/StudentSocials); БОНУС-фикс updateStudent: полная замена { ...s, id } → merge { ...st, ...s, id } — раньше редактирование стирало archived/archivedAt (сейчас редактор архивного недоступен из UI, но фикс защищает данные).
- ep-student-modal.tsx (переписан): переключатель вкладок «Ученик»/«Родитель» в стиле вкладок авторизации (ep-bg-base, активная — var(--ep-accent), role=tab/tablist/tabpanel); фото сверху над вкладками; вкладка «Ученик»: имя, телефон+email, дата рождения, ставка+баланс, заметки(60); вкладка «Родитель»: имя, почта+номер телефона, заметки(200, счётчик), блок соцсетей ВКонтакте/Telegram/MAX (переехал сюда из студенческой части; валидация/нормализация/«пустое поле = удалить» сохранены).
- Анти-ловушка нативной валидации: hidden-поля с required/type=email молча блокируют submit → убраны required/min, email → type="text" + inputMode="email"; ручная валидация в handleSubmit с автопереключением на нужную вкладку: пустое имя / некорректная ставка → «Ученик», невалидная соцссылка → «Родитель» (+тосты).
- parent сохраняется только если заполнено хоть одно поле (включая соцсети); все поля родителя тримятся; Telegram нормализует сху (t.me/… → https://t.me/…).
- E2E (agent-browser): регистрация тест-юзера → вкладки на месте; пустой сабмит → тост «Укажите имя ученика»; ученик Анна + родитель (мама, почта, телефон, заметки, VK + невалидный tg://bad) → тост «Проверьте ссылки…», вкладка «Родитель» осталась активной, ошибка под полем Telegram; исправлено на t.me/… → сохранено; round-trip: переоткрытие редактора показывает все значения родителя; localStorage: parent{...} без student.socials, version 2.
- МИГРАЦИЯ на живых данных: инжект v1-формата (socials на уровне ученика) + блокировка /api/data → reload → localStorage v2, socials перенесены в parent.socials; UI: вкладка «Родитель» показывает legacy VK/MAX. Реальный пользователь (Тимур, timyr112003@mail.ru) в БД УЖЕ в новом формате: parent.socials.telegram=https://t.me/thomasage — миграция прошла вживую через его открытую вкладку (HMR/pull) и ушла на сервер.
- Карточка ученика без соцсетей (vk.com/max.ru/t.me отсутствуют в DOM) — подтверждено.
- tsc --noEmit: 0 ошибок в src/; ESLint (6 изменённых файлов): 0 ошибок. Консоль браузера без ошибок.
- Тестовый юзер удалён из БД (остались только реальные thomfvdasage@yandex.ru, timyr112003@mail.ru — не тронуты). Браузер закрыт, приложение :3000 healthy.
- Архив пересобран: download/englishpro-with-abonements.tar.gz — 145 файлов, 288 КБ, без .env/db/node_modules/.next/skills/.tarbuild (мусорная копия .tarbuild удалена из песочницы).

Stage Summary:
- Редактор карточки ученика теперь двухвкладочный: «Ученик» (данные, ставка, баланс) и «Родитель» (имя, почта, телефон, заметки, соцсети VK/TG/MAX).
- Соцсети переехали на уровень контактов родителя: student.parent.socials; данные всех существующих пользователей мигрируют автоматически (localStorage v1→v2, серверный pull, импорт файла) — проверено вживую на реальном пользователе.
- Валидация умная: ошибки подсвечиваются на своей вкладке, форма сама переключает вкладку и показывает тост.

---
Task ID: 15
Agent: Super Z (main)
Task: Соцсети ученика — добавление прямо на карточке ученика (student.socials возвращаются как собственные соцсети ученика)

Work Log:
- Модель: student.socials снова актуальны — теперь это СОБСТВЕННЫЕ соцсети ученика (карточка), parent.socials — соцсети родителя (вкладка «Родитель» редактора). Два независимых набора.
- Защита миграции от поедания новых данных: ep-sync.ts ввёл маркер формата DATA_FORMAT=2 в снапшот (collectData → PUT /api/data); normalizeStudentsParentFields (ep-utils) теперь переносит student.socials → parent.socials ТОЛЬКО когда у ученика нет parent (старые данные) и только для снапшотов format !== 2. Реальные пользователи не затронуты (проверено в БД).
- Гейтинг по версиям: экспорт JSON — version 2 (было 1), импорт — миграция только для version < 2; резервная копия браузера (clearLocalDataWithBackup) — version 2, readLegacyBackup возвращает { version, data }, восстановление — миграция только для version < 2 (ep-settings.tsx).
- ep-store.ts: новый action updateStudentSocials(id, socials|undefined) — точечное обновление без перезаписи остальных полей ученика.
- Новый компонент ep-student-social-modal.tsx: модалка «Соцсети ученика» (ВКонтакте/Telegram/MAX, иконки в фирменных цветах, валидация validateSocialUrl с ошибками под полями, нормализация https://, «пустое поле = удалить»); заголовок с именем ученика.
- ep-layout.tsx: case 'student-social' + aria-label «Соцсети ученика».
- ep-students.tsx (карточка): под строкой контактов ряд соцсетей — иконки-ссылки (target=_blank, hover-scale, tooltip с короткой ссылкой) + кнопка «+»/«карандаш» (добавить/редактировать); для архивных — только иконки без кнопки; в режиме выбора ряд некликабелен (pointerEvents none, stopPropagation на ссылках).
- НАЙДЕН И ИСПРАВЛЕН БАГ: в ep-student-modal.tsx черновики соцсетей родителя сидировались с fallback на student.socials (наследие Task 14) — из-за этого VK ученика протёк в контакты родителя при первом сохранении. Fallback удалён: родительские соцсети берутся только из parent.socials; комментарий обновлён.
- E2E (agent-browser, новый тест-юзер): «+» на карточке → модалка → невалидный Telegram (telegram.com/@bad) → «Некорректная ссылка Telegram…», модалка не закрылась → t.me/petr_ch + vk.com/petr_ch → сохранено, на карточке 2 иконки-ссылки с нормализованными https → переоткрытие (карандаш) с предзаполнением → очистка Telegram → иконка исчезла, VK остался; параллельно заполнен родитель (имя + Telegram + MAX) → localStorage/БД: student.socials={vk} И parent.socials={telegram,max} сосуществуют, format: 2 в серверном снапшоте.
- tsc --noEmit: 0 ошибок в src/; ESLint (8 файлов): 0 ошибок; консоль браузера чистая.
- Тестовый юзер удалён из БД (реальные thomfvdasage@yandex.ru, timyr112003@mail.ru не тронуты), браузер закрыт, :3000 healthy.
- Архив пересобран: download/englishpro-with-abonements.tar.gz — 146 файлов, 289 КБ (включая ep-student-social-modal.tsx).

Stage Summary:
- Соцсети ученика добавляются/редактируются прямо на карточке (иконки + кнопка), соцсети родителя — во вкладке «Родитель» редактора; наборы независимы и сосуществуют в данных.
- Введён маркер формата снапшота format=2: миграция старых данных выполняется строго один раз и больше не трогает собственные соцсети ученика; экспорт/бэкапы версионированы.

---
Task ID: 16
Agent: Super Z (main)
Task: Консультация по архитектуре ролей и регистрации через администратора (без изменений кода — пользователь явно попросил «ничего не добавляй, просто подумай»)

Work Log:
- Проанализировал текущую архитектуру auth (User/Session + ep_session cookie, /api/auth/*, /api/data JSON-blob) применительно к мультиролевой модели.
- Сформулировал предложение в чат: 3 роли (MAIN_ADMIN / ADMIN / TEACHER), роль MAIN_ADMIN назначается только в БД (нельзя получить/снять через UI), статус DISABLED вместо жёсткого удаления, регистрация только через админа (временный пароль + mustChangePassword), имперсонация read-only через отдельную куку с серверной блокировкой push /api/data, статистика агрегатами из JSON-блобов с TTL-кэшем, журнал аудита AuditLog.

Stage Summary:
- Код не менялся, БД не тронута. Для старта внедрения ждёт ответов: кто из текущих юзеров главный админ; могут ли младшие админы управлять другими младшими админами; удаление = отключение?; просмотр только read-only?; публичную регистрацию убрать полностью?
- Ключевые риски зафиксированы: смешивание данных в localStorage при имперсонации (нужен сброс/изоляция persist), серверная (не UI) проверка прав, запрет взаимного управления админами одного уровня на усмотрение владельца.

---
Task ID: 17
Agent: Super Z (main)
Task: Внедрение системы ролей и регистрации через администратора (этапы 1–3 одним циклом)

Work Log:
- Решения владельца: главный админ thomasage@yandex.ru (пароль выдан в чате, установлен скриптом), админы не управляют друг другом (только учителями), «удаление» = архивация с восстановлением, вход в аккаунты С правом редактирования, публичная регистрация убрана.
- Бэкап БД: backups/englishpro-20260925-182426.db (VACUUM INTO).
- Prisma: User + role/status/mustChangePassword, новая модель AuditLog; db push + generate (env -u DATABASE_URL). scripts/setup-main-admin.mjs — создать/обновить MAIN_ADMIN (пароль только через env), audit BOOTSTRAP_MAIN_ADMIN.
- ep-server-auth.ts: SessionUser {role,status,mustChangePassword}, canManage (MAIN_ADMIN → все кроме себя и MAIN_ADMIN; ADMIN → только TEACHER), cookie ep_view_as + getEffectiveUser() (перепроверка прав/статуса на каждый запрос; устаревшая кука молча игнорируется), revokeUserSessions, audit().
- API: register → 403; login блокирует DISABLED + audit LOGIN; me → {user, impersonating}; change-password сбрасывает mustChangePassword; profile и /api/data (GET/PUT) работают от effective user; PUT /api/data при невалидной куке просмотра → 409 (чужие данные не затирают свои); /api/admin/users (GET/POST), /api/admin/users/[id] PATCH (role/archive/restore/password; archive/password отзывают сессии), /api/admin/users/[id]/impersonate POST, /api/admin/impersonate DELETE, /api/admin/stats (агрегаты из JSON-блобов, TRANSFER-категории исключены), /api/admin/audit.
- Клиент: currentUser.role/mustChangePassword, viewing, dataOwnerId (persist v2) + resetLocalData() в ep-sync (защита от смешивания данных при смене владельца), startImpersonation/stopImpersonation → location.reload(); ep-auth без регистрации; ep-force-password-change при mustChangePassword; сайдбар: «Админка» только админам; ep-layout: sticky-баннер «Режим управления» + сдвиг header (top-10), страница admin, модалка admin-create-user; ep-admin.tsx: Пользователи (поиск, создать, войти, пароль, в админы/в учителя, архив/восстановить), Статистика (итого + по пользователям: ученики/абонементы/баланс/занятия/доход/расход за месяц), Журнал (200 записей, человекочитаемые лейблы); ep-admin-create-user-modal: генерация пароля, показ учётных данных + копирование; ESLint react-hooks/set-state-in-effect — загрузки через api().then(applyX) с alive-флагом, refresh списка после создания — через render-time паттерн (lastModal/userListKey).
- Главный админ создан: thomasage@yandex.ru / MAIN_ADMIN / ACTIVE (имя «Главный администратор», меняется в Настройках). Реальные данные Тимура (timyr112003@mail.ru) не тронуты; thomfvdasage@yandex.ru — TEACHER (пустой, можно заархивировать через UI).
- E2E agent-browser: экран входа без регистрации; логин админа; админка: self-кнопки disabled; создание «Тестовый Учитель» (учётные данные на экране); имперсонация: баннер + создание ученика «Мария Петрова» с правом редактирования; выход: баннер исчез, у админа учеников нет (admin-data-clean); БД: ученик в аккаунте учителя; журнал: USER_CREATED/IMPERSONATE_START/END/BOOTSTRAP; учитель: нет «Админки», admin API → 403; force password change при входе с временным паролем; архивация: бейдж АРХИВ + «Восстановить», логин архивированного → 403 «Аккаунт архивирован»; API: restore ok, password reset ok (mustChange=true), role change под младшим админом → 403, archive self → 403, archive MAIN_ADMIN → 403; мобильный 390px без горизонтального скролла; консоль чистая.
- ИНЦИДЕНТ (устранён): после db push dev-сервер работал со СТАРЫМ Prisma-клиентом → role отдавался как TEACHER, me → 401 (status=undefined ≠ ACTIVE). Фикс: перезапуск next dev. Нюанс песочницы: фоновые процессы из bash-команд прибиваются между вызовами; рабочий паттерн: ( setsid env -u DATABASE_URL bun run dev </dev/null >>dev.log 2>&1 & ) — выживает между вызовами.
- Чистка: тестовый юзер удалён из БД (user+sessions+userData+audit), реальные аккаунты не тронуты; архив пересобран download/englishpro-with-abonements.tar.gz (1.2МБ, 204 файла, без node_modules/.next/skills/db/.env/backups, scripts/setup-main-admin.mjs включён).

Stage Summary:
- Работает: вход только по аккаунтам от админа; роли MAIN_ADMIN/ADMIN/TEACHER с серверной проверкой прав; главный админ защищён (никто не может архивировать/менять роль, нельзя через API сделать второго MAIN_ADMIN); младшие админы управляют только учителями; архивация с восстановлением и мгновенной отзывом сессий; вход в аккаунты с правом редактирования + sticky-баннер + журнал; статистика агрегатами (сырые данные учителей не отдаются); журнал аудита на 200 записей.
- Роль MAIN_ADMIN назначается только скриптом scripts/setup-main-admin.mjs (через UI не получить/не снять).
- Известные ограничения: статистика считает месяц по UTC (для Москвы возможен сдвиг у ночных операций); нет rate-limit на логин; смена пароля главного админа — через Настройки (change-password).

---
Task ID: 20
Agent: Super Z (main)
Task: Отдельный кабинет администратора (без учительского функционала) + два аккаунта на одну почту

Work Log:
- Решения владельца: админы не получают учительский стол — вместо него кабинет администратора; дубли почты разрешены (пароли могут совпадать → экран выбора); галочка «сразу создать учительский аккаунт на эту же почту» при создании админа; рекомендации по кабинету приняты (блок «Требует внимания» — да; CSV — позже; преподавание владельца — отдельным учительским аккаунтом на ту же почту).
- Бэкап БД: backups/englishpro-20260925-192656.db; Prisma: User.email без @unique (db push + generate, env -u DATABASE_URL).
- login API: перебор всех активных аккаунтов почты, verifyPassword по каждому; 1 совпадение → вход; ≥2 → {needChoice, options:[{id,name,role,mustChangePassword}]} (выбор виден только после верного пароля); chosenId → вход в конкретный аккаунт; только DISABLED → 403 «Аккаунт архивирован».
- ep-store: login(email, password, userId?) → LoginResult {ok, error?, needChoice?, options?}; типы LoginChoiceOption/LoginResult.
- ep-auth: экран «На эту почту заведено несколько аккаунтов» с карточками (имя, роль-бейдж, подсказка), «Назад к вводу пароля».
- admin/users POST: дубль почты → 409 {duplicate, existing} + allowDuplicate:true при подтверждении; twinTeacher (только MAIN_ADMIN, только к ADMIN) — парный учительский аккаунт с сервер-генерированным паролем, audit USER_CREATED ×2 (meta.twinOf); profile PUT: снята проверка уникальности email.
- stats API: ?period=month|quarter|year|all (from/to диапазоны для занятий и финансов); attention {expiringSubscriptions ≤7 дней + expiringTeachers, debtStudents/debtTotal + debtTeachers} — только агрегаты, без имён учеников; поля переименованы *Period.
- ep-cabinet.tsx (NEW, ~1200 строк): собственный сайдбар «Панель администратора» (Обзор/Пользователи/Статистика/Журнал/Настройки), мобильный hamburger, SyncIndicator, тема, выход; Обзор = 6 метрик + «Требует внимания» + «Учителя за месяц» (сортировка по доходу, кнопка Войти) + последние 8 событий журнала + «Добавить пользователя»; Пользователи/Статистика/Журнал перенесены из ep-admin.tsx (+ переключатель периодов, + подписи ролей у email в журнале для дублей почты); Настройки = профиль (имя/email) + смена пароля; модалка admin-create-user + EpConfirmDialog в кабинете; refresh разделов после закрытия модалки (lastModal/dataKey паттерн).
- ep-app: ветка isAdminCabinet (роль ADMIN/MAIN_ADMIN и !viewing) → EpAdminCabinet; в режиме управления показывается учительский стол с баннером.
- ep-layout/ep-sidebar/ep-types: PageType без 'admin', пункт «Админка» удалён, ep-admin.tsx удалён (переехал в кабинет).
- ep-admin-create-user-modal: галочка «Также создать учительский аккаунт на эту же почту» (MAIN_ADMIN, роль ADMIN), 409-подтверждение дубля («Всё равно создать»/«Изменить email»), экран учётных данных двух аккаунтов + «Скопировать оба».
- setup-main-admin.mjs: findUnique → findFirst.
- E2E agent-browser: вход MAIN_ADMIN → кабинет (Обзор с метриками 2 учителя/1 ученик/595 653 ₽; «Всё спокойно»); Пользователи (self disabled, без «В админы» у не-главного); создание админа с галочкой → 2 блока учётных данных; третий аккаунт на ту же почту → 409-подтверждение → создан; вход с паролем, верным 2 учителям → экран выбора (2 карточки) → force password change → учительский стол БЕЗ «Админки»; вход младшего админа → force change → кабинет; имперсонация в тестового учителя → баннер «Режим управления» → «Вернуться» → кабинет; Статистика: переключатель Месяц/3 месяца/Год/Всё время; Журнал: подписи ролей у дублей почты; Настройки: профиль + смена пароля рендерятся. Нюанс автоматизации: CDP-клик по sidebar-link/submit-кнопке иногда не доходил — проверено JS-кликами (не баг приложения; requestSubmit подтвердил работу формы).
- Чистка: 3 тестовых аккаунта (test.admin@example.com) удалены из БД вместе с сессиями/UserData/audit-записями; реальные не тронуты (thomasage MAIN_ADMIN, timyr TEACHER с данными, thomfvdasage TEACHER).
- tsc --noEmit: 0 ошибок в src/; ESLint --max-warnings=0: чисто. Архив download/englishpro-with-abonements.tar.gz пересобран (205КБ, 154 файла, без .env/db/node_modules/.next).

Stage Summary:
- Работает: кабинет администратора вместо учительского стола для MAIN_ADMIN/ADMIN (вход админа — сразу в кабинет; в режиме управления — учительский стол с баннером); два+ аккаунта на одну почту с экраном выбора при совпадении паролей; парный учительский аккаунт создается галочкой; статистика с периодами и «Требует внимания»; журнал с ролями у дублей.
- Иерархия прав сохранена: MAIN_ADMIN управляет всеми кроме MAIN_ADMIN; ADMIN — только учителями; MAIN_ADMIN-строка без кнопок.
- Известные ограничения: экран выбора показывает роль и имя, но без email-алиасов; CSV-экспорт статистики не делался (по решению владельца — позже); «Требует внимания» считает по активным (не архивным) студентам и не замороженным абонементам.

---
Task ID: 21
Agent: Super Z (main)
Task: Консультация — отказ от двух аккаунтов на одну почту в пользу ОДНОГО аккаунта с набором ролей и переключателем кабинетов (владелец явно попросил: «пока не вноси изменений, скажи как это будет выглядеть»)

Work Log:
- Владелец изменил решение по Task 20: один логин/пароль на человека; у аккаунта может быть несколько ролей (учитель + админ); переключение «Преподаватель ↔ Админ» внутри аккаунта без повторного входа; при назначении учителя админом появляется вторая этикетка; twin-аккаунты не нужны.
- Спроектировал целевую модель (без кода): User.role → User.roles (набор, MAIN_ADMIN включает админ-права и может + TEACHER); вход без экрана выбора; сегмент-переключатель кабинетов в сайдбаре только у гибридов, запоминание последнего кабинета; в Пользователях две этикетки у гибрида, добавление/снятие роли ADMIN вместо замены роли; демонтаж needChoice-экрана, 409-подтверждений дубля почты, twin-галочки; возврат @unique email; «Войти как» остаётся только для чужих учительских аккаунтов; canManage: ADMIN управляет только аккаунтами с ролями ⊆ {TEACHER}; MAIN_ADMIN может сам себе включить учительскую роль; настройки в обоих кабинетах правят один и тот же аккаунт.
- Краевые случаи: смена ролей подхватывается после F5/следующего входа (сессия не рвётся); защита последнего админа; архивация блокирует оба кабинета; сброс пароля один на всё; переключение кабинетов НЕ пишется в журнал аудита.
- Миграция тривиальная: реальных дублей почты в БД нет (тестовые удалены) — timyr/thomfvdasage → ["TEACHER"], thomasage → ["MAIN_ADMIN"].
- Код не менялся, БД не тронута. Реализация — Task 22 после ответов владельца на 2 вопроса (дефолтный кабинет гибрида; давать ли владельцу учительскую роль сейчас).

Stage Summary:
- Целевая модель: один аккаунт = один пароль = набор ролей; кабинет определяется активным режимом, а не отдельной учёткой. Прошлый план Task 20 (дубли почты, экран выбора, twin-аккаунты) подлежит демонтажу при реализации.
- Ждёт ответов: (1) какой кабинет открывать гибриду при входе — последний использованный (рекомендация) или всегда учительский; (2) включить ли владельцу (MAIN_ADMIN) учительскую роль сейчас, чтобы появился переключатель.

---
Task ID: 22
Agent: Super Z (main)
Task: Внедрение модели «один аккаунт — набор ролей» с экраном выбора кабинета и переключателем (демонтаж двух аккаунтов на одну почту)

Work Log:
- Решения владельца: после ввода логина/пароля гибриду (учитель+админ) показывается экран выбора кабинета; владельцу учительскую роль НЕ включать (остаётся чистым админом).
- Бэкапы БД: backups/englishpro-20260925-214718.db (+ второй перед чисткой). Найден и удалён пустой дубль svdvd@mail.ru (2 аккаунта «томас», созданы в одну секунду, 0 данных/0 сессий — случайное двойное создание; оставлен один).
- Prisma: User.role → User.roles (JSON-набор, дэфолт ["TEACHER"]), email снова @unique; db push --accept-data-loss + generate (env -u DATABASE_URL). scripts/migrate-roles.mjs — заполнение ролей (MAIN_ADMIN_EMAIL из .env → thomasage@yandex.ru).
- ep-server-auth: SessionUser.roles: Role[]; parseRoles() с безопасным дефолтом ["TEACHER"]; isAdminRoles(roles); canManage: MAIN_ADMIN → все кроме MAIN_ADMIN; ADMIN → только чистые учителя (roles == ["TEACHER"]); getEffectiveUser парсит роли цели.
- login: один аккаунт на почту (findUnique), без needChoice/перебора; users GET: roles + сортировка по старшинству; users POST: roles-набор {TEACHER, ADMIN} (ADMIN — только MAIN_ADMIN), P2002 → 409 «почта уже используется», twin-логика удалена; [id] PATCH: action addRole/removeRole (только MAIN_ADMIN, не MAIN_ADMIN-цель, непустой итоговый набор, 400 при дубликате/отсутствии роли), audit ROLE_ADDED/ROLE_REMOVED {role, roles}; impersonate: цель обязана иметь TEACHER (иначе 400 «нет учительского кабинета»); profile PUT: проверка занятости email → 409; stats: roles в выборке и ответе.
- Клиент: ep-types — isAdminRoles/hasTeacherRole/isHybridRoles; ep-store — currentUser.roles, activeCabinet ('teacher'|'admin'|null, в partialize; сбрасывается в null при login/logout; initAuth приводит в соответствие ролям), login без userId, setActiveCabinet; ep-app — viewing → учительский стол; гибрид без выбора → EpCabinetChoice, иначе кабинет по activeCabinet; одноролевые — автоматически.
- Новые компоненты: ep-role-badges.tsx (RoleBadge/RoleBadges, порядок MAIN_ADMIN→ADMIN→TEACHER), ep-cabinet-choice.tsx (карточки «Преподаватель»/«Администратор»); ep-auth упрощён (экран выбора аккаунтов удалён); ep-sidebar — сегмент-переключатель «Учитель | Админ» для гибридов (в режиме управления скрыт) + бейджи в футере; ep-cabinet — переключатель «Админ | Учитель» (акцент #ffb400), бейджи во всех разделах, UsersTab: «Сделать админом» (чистому учителю) / «Снять админа»+«Снять учителя» (гибриду) / «Добавить учителя» (чистому админу), для MAIN_ADMIN-строки ролевых кнопок нет, «Войти» только при наличии TEACHER (у себя disabled), canManageThis = серверная логика; StatsTab/OverviewTab: учителя = roles.includes(TEACHER), «это вы» вместо «Войти» на своей строке, «нет кабинета» у чистых админов; AuditTab: ROLE_ADDED/ROLE_REMOVED + исторические ROLE_CHANGED from→to + meta.roles; Настройки: новая подсказка про логин/кабинеты.
- ep-admin-create-user-modal: две галочки ролей («Учитель» по умолчанию; «Администратор» виден только MAIN_ADMIN), один пароль, без twin-блока и 409-подтверждения; экран учётных данных с ролями.
- setup-main-admin.mjs: roles JSON, findUnique, audit возвращён.
- Проверки: tsc (src) 0 ошибок; ESLint чисто. API-curl: вход владельца ['MAIN_ADMIN']; 409 дубль; 400 пустые роли; смена временного пароля; гибрид-админ PATCH → 403; removeRole→['ADMIN'], повтор → 400, возврат → ['ADMIN','TEACHER']; пустой набор → 400; MAIN_ADMIN-цель → 403; профиль на чужую почту → 409; имперсонация гибрида ok; журнал с ROLE_ADDED/ROLE_REMOVED.
- E2E agent-browser: вход гибрида → экран «С возвращением, Тест Гибрид!» с двумя карточками → учительский стол (переключатель «Учитель ● | Админ») → мгновенное переключение в кабинет админа и обратно без реавторизации; F5 сохраняет кабинет (activeCabinet=admin в localStorage); повторный вход → экран выбора снова; владелец → сразу кабинет без выбора и без переключателя; Пользователи: у гибрида 2 этикетки «АДМИНИСТРАТОР | УЧИТЕЛЬ», у чистого учителя 1 + «Сделать админом», у владельца без ролевых кнопок (фикс: скрыты, сервер 403 не достигается); цикл «Сделать админом» → 2 этикетки → «Снять админа» → 1 этикетка через диалоги; модалка: обе галочки, создание учителя, экран учётных данных «Роли: Учитель»; вход нового учителя с временным паролем → смена → сразу стол, 0 табов-переключателей; мобильный 390px: бургер открывает меню с видимым переключателем; консоль и dev.log без ошибок.
- Чистка: тестовые hybrid-test/teacher-ui удалены из БД (+сессии/UserData/14 записей журнала); реальные аккаунты не тронуты (thomasage MAIN_ADMIN, timyr/thomfvdasage/svdvd TEACHER). Архив пересобран: download/englishpro-with-abonements.tar.gz — 326 КБ, 172 файла (убран .git, .zscripts, tsbuildinfo; включены migrate-roles.mjs и новые компоненты).
- Сервер: :3000 healthy после перезапуска (смена Prisma-клиента требовала рестарт — известный нюанс Task 17).

Stage Summary:
- Работает финальная модель: один логин/пароль на человека; у аккаунта набор ролей (учитель и/или админ); после входа гибрид выбирает кабинет (каждый раз), внутри сессии переключается сегментом в сайдбаре без реавторизации, F5 запоминает выбор; у гибрида две этикетки; демонтажены дубли почты, экран выбора аккаунтов и twin-аккаунты; почта снова уникальна.
- Права: MAIN_ADMIN управляет всеми кроме себя/MAIN_ADMIN и единственный, кто меняет роли; ADMIN — только чистые учителя; имперсонация только в учительские кабинеты (TEACHER-роль обязательна), своей строки не касается.
- Известные ограничения: экран выбора показывается при каждом входе (по решению владельца, «последний кабинет» не используется как основной — только для F5); у владельца учительской роли нет (по решению); «Снять учителя» доступно только владельцем у гибридов.

---
Task ID: 23
Agent: Super Z (main)
Task: Правки UI по отзыву владельца: этикетки в футере сайдбара, перенос переключателя кабинетов в Настройки, скрытие нерабочих кнопок «В архив»/«Пароль» в Пользователях

Work Log:
- Запрос владельца (5 пунктов): (1) убрать этикетки ролей у имени в нижней панели сайдбара; (2) переключение учитель↔админ перенести в Настройки; (3) убрать кнопки «В архив»/«Пароль» у главного администратора; (4) то же у других админов (не имеют права менять/входить в аккаунты других админов); (5) то же у текущего аккаунта.
- ep-sidebar.tsx (учительский сайдбар): удалён сегмент-переключатель «Учитель | Админ» (и из мобильного бургера — он тот же сайдбар); из футера убраны RoleBadges у имени; вычищены импорты isHybridRoles/RoleBadges и селектор setActiveCabinet.
- ep-cabinet.tsx (админ-сайдбар): удалён переключатель «Админ | Учитель»; из футера убраны RoleBadges у имени. Этикетки в шапке кабинета (справа сверху) СОХРАНЕНЫ — владелец просил только про нижнюю панель у имени.
- Переключение кабинетов перенесено в Настройки: ep-settings.tsx — новая карточка «Кабинет» (первая, только у гибридов): «Сейчас открыт учительский кабинет» + кнопка «В кабинет администратора» (setActiveCabinet('admin')); CabinetSettingsTab (ep-cabinet.tsx) — карточка «Кабинет» с кнопкой «В учительский кабинет» (setActiveCabinet('teacher')). Переключение по-прежнему мгновенное, без реавторизации; экран выбора после входа (ep-cabinet-choice) не тронут, его подсказка обновлена («Переключить кабинет можно в любой момент — в Настройках»).
- UsersTab (ep-cabinet.tsx): «Пароль» и «Архив/Восстановить» показываются ТОЛЬКО если canManageThis И цель — чистый учитель (без роли ADMIN): у MAIN_ADMIN-строки, у гибридов/чистых админов и у своей строки кнопок больше нет (раньше были disabled). Ролевые кнопки MAIN_ADMIN («Снять админа»/«Снять учителя»/«Сделать админом»/«Добавить учителя») сохранены — это отдельный рабочий механизм управления ролями. «Войти» (имперсонация) теперь тоже гейтится canManageThis (раньше у младшего админа на гибридах была нерабочая кнопка); на своей строке вместо disabled-«Войти» — подпись «это вы». Подсказки-титулы приведены к новой логике (Настройки вместо «переключателя в сайдбаре» — OverviewTab/StatsTab).
- Сервер НЕ менялся: canManage остался прежним (MAIN_ADMIN → все кроме MAIN_ADMIN; ADMIN → только чистые учителя) — ролевые кнопки у гибридов продолжают работать; правка чисто UI-гейтинг.
- Мелочь: подсказка под email в настройках админ-кабинета про карточку «Кабинет» показывается только гибридам.
- Проверки: tsc (src) 0 ошибок; ESLint чисто. E2E agent-browser: гибрид (тестовый ui-fix-hybrid@test.local) — учительские Настройки: карточка «Кабинет» есть, переключение в админ мгновенное; админские Настройки: карточка с кнопкой «В учительский кабинет», возврат работает; футеры обоих сайдбаров без этикеток; Пользователи от гибрида: MAIN_ADMIN/свой/другой гибрид — без кнопок, чистые учителя — [Войти, Пароль, Архив]; владелец: своя строка без кнопок, у гибридов [Войти, Снять админа, Снять учителя] (без Пароль/Архив), у чистых учителей полный набор [Войти, Пароль, Сделать админом, Архив]; у владельца карточки «Кабинет» в настройках нет; мобильный 390px — бургер открывается, футер чистый; консоль без ошибок.
- ВАЖНО (реальные данные): svdvd@mail.ru в БД — ГИБРИД ["TEACHER","ADMIN"] (владелец назначил его админом после Task 22), т.е. «другие админы» из запроса — это прежде всего его строка. worklog Task 22 устарел на этот счёт.
- Чистка: тестовый гибрид удалён вместе с сессиями/UserData/журнальными следами (scripts/e2e-make-hybrid.mjs, scripts/e2e-remove-hybrid.mjs); реальные аккаунты не тронуты. Бэкап перед работой: backups/englishpro-20260925-223240.db. Архив пересобран: download/englishpro-with-abonements.tar.gz (515 КБ, 172 файла).

Stage Summary:
- Нижняя панель сайдбара (оба кабинета) показывает только имя и почту — этикеток ролей больше нет.
- Переключение кабинетов гибрида — только через Настройки (карточка «Кабинет» в обоих кабинетах); в сайдбарах и бургере переключателей нет; экран выбора после входа сохранён.
- В «Пользователях» кнопки «Пароль» и «Архив/Восстановить» видны только у чистых учителей, которыми смотрящий вправе управлять; у главного админа, других админов (гибридов и чистых) и своей строки их нет; «Войти» тоже только туда, где сервер реально пустит; на своей строке — «это вы».
- Этикетки ролей в списке Пользователей и в шапке админ-кабинета сохранены (владелец просил убрать только у имени в нижней панели).

---
Task ID: 24
Agent: Super Z (main)
Task: Правки UI по отзыву владельца: профиль в настройках админа как у учителя (роль «Админ»), переключатель кабинетов — в панель «Профиль», главный админ убран из окна статистики

Work Log:
- Запрос владельца (3 пункта): (1) у админов в настройке «Профиль» сделать похоже на учительский, только роль «Админ»; (2) кнопку переключения учитель↔админ перенести в панель «Профиль» в настройках; (3) убрать главного админа из окна статистики.
- API /api/admin/stats: из разбивки по пользователям исключены аккаунты без роли TEACHER (главный админ и чистые администраторы — своих данных не имеют); фильтр после выборки активных через parseRoles().includes('TEACHER'), гибриды «админ+учитель» остаются; totals/attention не изменились (вклад исключённых нулевой). Комментарий докручен («Сводная статистика по учителям»).
- StatsTab (ep-cabinet.tsx): удалена мёртвая ветка «нет кабинета» — после фильтра API у всех строк есть TEACHER, осталось только «это вы»/«Войти»; убран ставший ненужным импорт hasTeacherRole.
- CabinetSettingsTab (ep-cabinet.tsx) переписан по образцу учительских настроек (ep-settings.tsx): карточка «Профиль» в режиме просмотра с кнопкой «Изменить» (инлайн-форма Имя/Email + Сохранить/Отмена), аватар 80px с фото-редактором EpPhotoEditor (скрытый file input, «Удалить фото», локальный превью до сохранения), строки Email / Роль: «Админ» / для гибридов — строка «Кабинет» с кнопкой «В учительский кабинет»; редактор фото — отдельный экран как у учителя; отдельная карточка «Кабинет» удалена (заголовок панели и подсказки обновлены). Роль в панели всегда «Админ» (по запросу владельца), MAIN_ADMIN и ADMIN не различаются.
- ep-settings.tsx (учительские настройки): отдельная карточка «Кабинет» удалена; переключение перенесено в панель «Профиль» — строка «Кабинет» с кнопкой «В кабинет администратора» после строки «Роль» (только у гибрида, в режиме просмотра).
- Переключение кабинетов по-прежнему мгновенное, без реавторизации, в аудит не пишется; экран выбора после входа (ep-cabinet-choice) не тронут.
- Сервер (права/ canManage/имперсонация) не менялся — правки чисто UI + фильтр статистики.
- Проверки: tsc (src) 0 ошибок; ESLint (изменённые файлы) чисто; API-curl под тестовым MAIN_ADMIN: в /api/admin/stats только 4 учителя (timyr, thomfvdasage, svdvd-гибрид, тестовый гибрид), thomasage и сам тестовый MAIN_ADMIN отсутствуют, totals корректны.
- E2E agent-browser: вход тестового MAIN_ADMIN → сразу кабинет; Статистика — 4 учителя, главного админа нет, «нет кабинета» не встречается; Настройки — панель «Профиль»: аватар, «Изменить» → форма Имя/Email → Отмена, строки Email / Роль: Админ, строки «Кабинет» нет (не гибрид), скрытый file input на месте; Гибрид (ui-fix-hybrid): экран выбора кабинета → админ-кабинет → Настройки: панель «Профиль» со строкой «Кабинет → В учительский кабинет», отдельной карточки «Кабинет» нет; клик → мгновенно учительский стол; учительские Настройки: карточки Профиль/Данные/Синхронизация/Изменение пароля/Оформление/О приложении (карточки «Кабинет» нет), строка «Кабинет → В кабинет администратора»; обратное переключение в админ-кабинет; Статистика от гибрида-админа — без главного админа; мобильный 390px: кнопка переключения в пределах экрана (right=287, flex-wrap); F5 сохраняет активный кабинет; консоль браузера и dev.log без ошибок.
- Чистка: тестовые аккаунты (ui-fix-hybrid@test.local, ui-fix-mainadmin@test.local) удалены из БД вместе с сессиями/UserData/аудитом (включая BOOTSTRAP_MAIN_ADMIN); реальные не тронуты (thomasage MAIN_ADMIN, timyr/thomfvdasage TEACHER, svdvd гибрид). Бэкап перед работой: backups/englishpro-20260925-225542.db. Архив пересобран: download/englishpro-with-abonements.tar.gz (182 файла, ~1МБ).

Stage Summary:
- Окно «Статистика» показывает только учителей (включая гибридов «админ+учитель»); главный администратор и чистые админы без учительской роли в списке не отображаются.
- Настройки админ-кабинета оформлены как учительские: панель «Профиль» с аватаром, фото-редактором, инлайн-редактированием и строками Email / Роль: «Админ»; переключение кабинетов гибрида — строкой «Кабинет» внутри панели «Профиль» (в обоих кабинетах), отдельных карточек «Кабинет» больше нет.
- Редактирование профиля и фото в админ-кабинете работает через те же API, что и в учительском (photo хранится в User.photo, один на все кабинеты).

---
Task ID: 25
Agent: Super Z (main)
Task: Консультация — отправка пароля на почту при создании аккаунта и напоминания о занятиях педагогу (владелец попросил: «не вноси изменения, только ответь и додумай»)

Work Log:
- Код и БД не тронуты. Спроектировал почтовую подсистему на бумаге: SMTP-шлюз (smtp.yandex.ru / сервисы рассылок), nodemailer + модуль ep-mail.ts, креды в .env, fallback на текущий экран учётных данных, аудит EMAIL_SENT.
- Пароль при создании: два варианта — письмо с временным паролем (задействует существующий mustChangePassword) vs одноразовая ссылка «придумайте пароль» (токен в БД, 24ч); рекомендован первый для старта.
- Напоминания учителю: дневная сводка (7:00) / за час до занятия / недельный план; запуск — системный crontab → защищённый GET /api/cron/reminders?secret (данные берутся разбором JSON-снапшотов, как в stats); дедупликация, Europe/Moscow, не слать при пустом дне.
- Додумал прочие применения почты: «Забыли пароль» (самостоятельный сброс), подтверждение email, уведомления безопасности владельцу (вход/смена пароля/роли/архивация/имперсонация — на основе AuditLog), недельный «Требует внимания» и месячный отчёт владельцу, недельная сводка учителю, письма родителям (нужно поле email в карточке), еженедельный бэкап на почту.
- Предложил этапность: v1 (mail-модуль + приглашение + сброс пароля + дневная сводка) → v2 (за час до занятия + security-уведомления + «Требует внимания») → v3 (родителям, отчёты, бэкапы).

Stage Summary:
- Ждёт решения владельца, какой этап подтверждать. Ничего не реализовано; SPF/DKIM, noreply-адрес, rate-limit сброса и запрет логирования паролей — учтены в плане.

---
Task ID: 26
Agent: Super Z (main)
Task: Снимок проекта перед «Этапом 1: почтовая инфраструктура» — архив для скачивания; код не менялся

Work Log:
- Код, БД и настройки не тронуты. Собран download/englishpro-before-email.tar.gz (root englishpro-before-email/, 1.1 МБ, 193 записи) с теми же исключениями, что у прошлых архивов (node_modules/.next/.git/db/backups/skills/tests/examples/download/tool-results/dev.log/server.log); включены src (132 файла), scripts (вкл. PNG-артефакты), public, prisma, mini-services, upload, конфиги (Dockerfile, docker-compose.yml, Caddyfile, next.config), .env (только локальный DATABASE_URL), worklog.md, PROJECT-README.md.
- Проверки: gzip -t OK; в архиве присутствуют ключевые файлы Task 24 (ep-cabinet.tsx, api/admin/stats/route.ts, ep-admin-create-user-modal.tsx) и worklog с записью Task 25.
- Дополнительно: свежий consistent-снимок БД через npm run backup (VACUUM INTO, 68 КБ) → копия download/englishpro-db-20260926.db; read-only проверка: 4 реальных аккаунта на месте (thomasage MAIN_ADMIN, timyr/thomfvdasage TEACHER, svdvd гибрид TEACHER+ADMIN).

Stage Summary:
- Владелец получил снимок кода (englishpro-before-email.tar.gz) и данных (englishpro-db-20260926.db) до старта почтовых работ. Следующий шаг — после подтверждения: nodemailer + .env-переменные + src/lib/mailer.ts + тестовая отправка (нужен пароль приложения Яндекса от владельца).

---
Task ID: 27
Agent: Super Z (main)
Task: Этап 1 почтовой подсистемы — инфраструктура отправки: nodemailer, mailer-модуль, API теста, карточка «Почта» в настройках админа

Work Log:
- Бэкап перед работой: backups/englishpro-20260925-233027.db. Установлены nodemailer@10.0.10 + @types/nodemailer@8.0.2 (bun add, bun.lock обновлён).
- Новый src/lib/mailer.ts: SMTP-креды только из env (SMTP_HOST/PORT/USER/PASS, MAIL_FROM; дефолты smtp.yandex.ru:465, подпись «EnglishPro <SMTP_USER>»); isMailConfigured() (USER+PASS), mailConfigInfo() (публичные сведения без секретов); ленивый Transporter (secure при 465), sendMail() НИКОГДА не бросает — возвращает {ok,messageId}|{ok:false,error}, при сбое транспорт пересоздаётся, лог в console с пометкой [mailer]; simpleMailHtml() — фирменный HTML-каркас письма (шапка EnglishPro, заголовок, абзацы, дисклеймер) для этапов 2–3.
- Новый API /api/admin/mail-test (только админы, eff.actor): GET — {configured, host, port, from}; POST — тестовое письмо (по умолчанию на почту запросившего, валидация), при неуспехе 502 {ok:false,error}, при незаданных кредах 400 с подсказкой; аудит MAIL_TEST (ok/error в meta, без секретов).
- .env: добавлены SMTP_HOST=smtp.yandex.ru, SMTP_PORT=465, пустые SMTP_USER/SMTP_PASS/MAIL_FROM с комментарием-инструкцией; создан .env.example (DATABASE_URL + SMTP-блок с пояснением про пароль приложения); docker-compose.yml — pass-through пяти SMTP-переменных из .env (дефолты host/port).
- UI (ep-cabinet.tsx CabinetSettingsTab): карточка «Почта» между «Профилем» и «Сменой пароля» — строка «Отправка писем» (статус из GET: «Настроена — письма уходят через {host}, от {from}» / «Не настроена — задайте SMTP_USER и SMTP_PASS в .env…»), строка «Тестовое письмо» с кнопкой «Отправить» (disabled при !configured || sending, спиннер), инлайн-результат (зелёный успех «проверьте Спам» / красная ошибка API); useEffect GET при монтировании.
- PROJECT-README.md: новый раздел «Почта (SMTP)» — настройка за 5 шагов (2FA → пароль приложения → .env/docker-compose → перезапуск → проверка карточкой «Почта»), описание архитектуры mailer.ts.
- Проверки: tsc по src — 0 ошибок; ESLint (mailer.ts, mail-test, ep-cabinet.tsx) — чисто. Сервер перезапущен (подхват env). curl: GET/POST без auth → 401; под тестовым MAIN_ADMIN: GET {configured:false,...}, POST → 400 с подсказкой. Боевой путь с заведомо неверным паролем SMTP (временные креды в .env): GET {configured:true, from:«EnglishPro <thomasage@yandex.ru>»}, POST → 502 «Invalid login: 535 5.7.8» — реальный SMTP-обмен до Яндекса, аккуратная ошибка без падения; затем креды возвращены в пустые, GET снова configured:false. Аудит MAIL_TEST писался и вычищен вместе с аккаунтом.
- E2E agent-browser: вход тестового MAIN_ADMIN → Настройки: карточка «Почта» между «Профилем» и «Сменой пароля», статус «Не настроена — …», строка «Придёт на вашу почту (mail-stage1@test.local)», кнопка «Отправить» disabled; мобильный 390px — карточка в пределах экрана (left 24, right 366); консоль и dev.log без ошибок. Скриншот scripts/stage1-mail-card.png.
- Чистка: тестовый mail-stage1@test.local удалён со всеми следами (scripts/e2e-remove-mailtest.mjs); реальные аккаунты не тронуты. Архив пересобран: download/englishpro-with-abonements.tar.gz (1.2 МБ, 199 записей, внутри mailer.ts/mail-test/.env.example).

Stage Summary:
- Этап 1 готов: приложение умеет отправлять письма через SMTP (единый mailer.ts, защищённый тест-роут, карточка статуса в настройках админа), пароль не падает операции, креды только в env. Реальная отправка заблокирована только отсутствием пароля приложения у владельца.
- Следующий шаг (владелец): 2FA на ящике Яндекса → Пароль приложения (id.yandex.ru → Безопасность → Пароли приложений) → передать его для .env (или заполнить самому) → перезапуск → кнопка «Отправить» в карточке «Почта» → письмо должно прийти.
- Этап 2 (пароль на почту при создании аккаунта) теперь сводится к правке POST /api/admin/users + ep-admin-create-user-modal поверх готового sendMail + существующего mustChangePassword.

---
Task ID: 28
Agent: Super Z (main)
Task: Владелец передал пароль приложения Яндекса — настройка .env и первая реальная попытка отправки

Work Log:
- .env заполнен: SMTP_USER=thomasage@yandex.ru, SMTP_PASS=(пароль приложения из чата), MAIL_FROM=«EnglishPro <thomasage@yandex.ru>»; сервер перезапущен, GET /api/admin/mail-test → {configured:true, from:«EnglishPro <thomasage@yandex.ru>»}.
- Реальная отправка под тестовым MAIN_ADMIN на thomasage@yandex.ru → 502: «Invalid login: 535 5.7.8 authentication failed: This user does not have access rights to this service». Соединение/TLS до smtp.yandex.ru проходит (ошибка на этапе AUTH) — транспорт и код работают; отказ со стороны Яндекса.
- Диагноз для владельца (частые причины 535 no-access): (1) в Яндекс.Почте выключены «Почтовые программы» (Настройки → Почтовые программы → включить IMAP/SMTP); (2) пароль приложения создан не для службы «Почта» (пароли сервис-специфичны) — пересоздать именно для «Почты»; (3) опечатка/усечение пароля.
- Тестовый mail-stage1@test.local удалён со следами (e2e-remove-mailtest.mjs), аудит MAIL_TEST чист, реальные аккаунты не тронуты. Креды в .env оставлены — после исправления доступа владельцем повторная проверка выполняется без изменений кода.

Stage Summary:
- Инфраструктура полностью готова и валидирована до этапа SMTP-AUTH; письмо блокирует только доступ пароля приложения к службе «Почта» на стороне Яндекса. Ждёт: включение «Почтовых программ» и/или новый пароль приложения от владельца → повторный POST mail-test → этап 2.

---
Task ID: 29
Agent: Super Z (main)
Task: Повторная проверка отправки после того, как владелец настроил доступ на стороне Яндекса («Проверь»)

Work Log:
- Креды в .env прежние (владелец включил доступ, пароль не менял). Тестовый MAIN_ADMIN создан заново, POST /api/admin/mail-test {to:thomasage@yandex.ru} → {ok:true}, HTTP 200.
- Лог: [mailer] письмо отправлено — to thomasage@yandex.ru, subject «EnglishPro — тестовое письмо», messageId <9021e6f0-2874-a627-8d36-f4c79fd79bed@yandex.ru>. Реальное письмо ушло через smtp.yandex.ru с подписью «EnglishPro <thomasage@yandex.ru>».
- Тестовый аккаунт удалён со следами (audit MAIL_TEST чист), реальные аккаунты не тронуты. Код не менялся.

Stage Summary:
- Этап 1 закрыт полностью: почтовый шлюз настроен и подтверждён реальной отправкой. Этап 2 (пароль на почту при создании аккаунта админом) стартует по команде владельца; напоминалка о проверке «Спама» передана владельцу.

---
Task ID: 30
Agent: Super Z (main)
Task: Этап 2 почтовой подсистемы — пароль на почту при создании аккаунта админом

Work Log:
- API POST /api/admin/users: новый режим sendByEmail:true — сервер генерирует временный пароль 10 символов (crypto.randomBytes, алфавит без 0/O/1/l/I), сохраняет hashPassword, mustChangePassword:true, шлёт приглашение (тема «EnglishPro — ваш аккаунт создан»: имя, логин, временный пароль, [ссылка APP_URL], просьба сменить при первом входе; escHtml для name/email/APP_URL); аудит USER_CREATED (meta.inviteByEmail) + INVITE_SENT {ok,error}. Ответ при успехе {user, emailSent:true} — БЕЗ пароля; при сбое письма аккаунт ВСЁ РАВНО создаётся, ответ {user, emailSent:false, emailError, oneTimePassword} — пароль отдаётся один раз для ручной передачи. Без sendByEmail — прежний ручной режим (валидация >=4 символов только в нём).
- Модалка ep-admin-create-user-modal.tsx переписана: при монтировании GET /api/admin/mail-test → mailConfigured; чекбокс «Выслать пароль на почту» (default checked, disabled+подсказка «Почта не настроена — задайте пароль вручную» при false, авто-снятие галочки); в email-режиме поле пароля/генератор скрыты, кнопка «Создать и выслать пароль» (спиннер «Создание и отправка…»); три экрана результата: (1) emailSent — зелёный блок «пароль выслан на …», логин/роли БЕЗ пароля, только «Готово»; (2) fallback emailSent:false — жёлтый блок «письмо не удалось: {ошибка}, передайте пароль вручную», пароль показан, «Скопировать данные»+«Готово»; (3) ручной режим — прежний экран учётных данных (ссылка «переключение кабинетов в настройках» вместо «в сайдбаре»); в ручном режиме ссылка «Вернуть отправку на почту».
- .env.example: добавлен необязательный APP_URL (ссылка «Войти» в письмах; в коде читается через process.env.APP_URL).
- Проверки: tsc по src 0 ошибок; ESLint чисто. curl: (1) sendByEmail:true → {user, emailSent:true}, письмо реально ушло (messageId <9be25990…@yandex.ru>, to stage2-invite@test.local), INVITE_SENT {ok:true}, mustChangePassword=1; (2) ручной режим → {user} без пароля в ответе; (3) дубль почты → 409; (4) fallback: SMTP_PASS временно сломан → {user, emailSent:false, emailError:«535…», oneTimePassword:«hmXthuJPEQ»}, аккаунт создан; креды восстановлены.
- E2E agent-browser (тестовый MAIN_ADMIN): модалка — чекбокс «Выслать пароль на почту» отмечен, поле пароля скрыто, кнопка «Создать и выслать пароль»; создание Ева Тестовая <stage2-e2e@test.local> → экран «пароль выслан на stage2-e2e@test.local», пароль нигде не показан (проверено regex), кнопка «Готово»; повторное открытие → снятие галочки → поле пароля (10 симв.), «Сгенерировать», «Создать аккаунт», ссылка «Вернуть отправку на почту»; мобильный 390px — модалка в пределах экрана (left 49, right 341); консоль без ошибок. Скриншоты scripts/stage2-invite-sent.png, stage2-mobile-modal.png.
- Чистка: 5 тестовых аккаунтов (mail-stage1, stage2-invite/-manual/-fallback/-e2e) удалены со всеми следами (scripts/e2e-remove-stage2.mjs); реальные не тронуты. Архив пересобран: download/englishpro-with-abonements.tar.gz (1.3 МБ, 202 записи). health 200.

Stage Summary:
- Этап 2 закрыт: при создании аккаунта админом пароль по умолчанию генерируется сервером и высылается на почту (админ его не видит), при первом входе — обязательная смена; сбой письма не ломает создание и даёт одноразовый ручной пароль; ручной режим сохранён как опция.
- Кандидаты на следующие этапы (по плану консультации): напоминания о занятиях педагогу (этап 3: планировщик + разбор UserData), «Забыли пароль», security-уведомления, письма родителям.

---
Task ID: 31
Agent: Super Z (main)
Task: Этап 3 — напоминания о занятиях педагогу (крон + разбор UserData)

Work Log:
- Обнаружено и исправлено: сессия окружения сбросилась — .env перезаписан (остался только DATABASE_URL), SMTP-креды этапа 1 и .env.example пропали. Восстановил .env (SMTP_HOST/PORT/USER/PASS, MAIL_FROM из переписки) и пересоздал .env.example (SMTP + новые CRON_SECRET, REMINDER_TIMEZONE). Dev-сервер перезапущен, health 200.
- Бэкап БД перед работой: backups/englishpro-20260926-110003.db (VACUUM INTO).
- Новый модуль src/lib/ep-reminders.ts — самостоятельный (без импортов, читается Node 24 прямо из исходника для скриптов): zoneNow/weekdayOf/addDays по REMINDER_TIMEZONE через Intl (сервер может жить в UTC), parseSnapshot UserData (ключи students[] и schedule[], как в stats), lessonsOnDay (только planned, сортировка по времени, группы разворачиваются по studentIds, архивные ученики скрыты), buildDailyMail/buildHourlyMail/buildWeeklyMail (HTML-блоки с экранированием + текстовые версии, русские склонения, durationLabel).
- mailer.ts: добавлен framedMailHtml (блоки вставляются «как есть» — для таблиц), simpleMailHtml теперь делегирует к нему (поведение этапов 1–2 не изменилось).
- Новый роут src/app/api/cron/reminders/route.ts: GET ?secret=CRON_SECRET&type=daily|hourly|weekly (&dry=1 — без отправки); 401 без/с неверным секретом, секрет не логируется; учителя = ACTIVE + роль TEACHER + непустой UserData; hourly — окно «начнётся в течение 60 минут и не началось», письмо на каждое занятие; daily/weekly — пропуск пустых дней/недели; дедупликация маркерами в AuditLog (REMINDER_SENT, meta {type,date,lessonId}) за 8 дней; сбой письма → REMINDER_ERROR, маркер не ставится, повтор на следующем запуске; аудит actor=null (системное).
- docker-compose.yml: pass-through CRON_SECRET и REMINDER_TIMEZONE (дефолт Europe/Moscow).
- Проверки: tsc по src 0 ошибок; ESLint чисто. curl: без секрета/неверный → 401; dry-run показал 2 реальных учителя (timyr, svdvd; thomasage — чистый админ и thomfvdasage без снапшота — корректно исключены) и пустые дни. Тестовый учитель stage3@test.local (scripts/stage3-make-test-user.mjs: занятие сегодня +50 мин, утром 09:00, отменённое 12:00, завтра, +2 группа, +6): daily → отправлено (2 занятий; отменённое исключено), hourly → отправлено (занятие в 14:59), weekly → отправлено (4 дн.); повторные вызовы → 0 отправок (дедупликация работает); 3 messageId от smtp.yandex.ru в dev.log.
- Превью владельцу: scripts/stage3-preview.mjs (импорт TS-модулей Node 24) отправил на thomasage@yandex.ru примеры дневной сводки и напоминания «за час» (2 messageId), HTML сохранён в scripts/stage3-preview.html; скриншот scripts/stage3-mail-preview.png — каркас, таблица (Время/Ученики/Длительность/Тема), заметки серым, метка «группа», склонения корректны.
- Чистка: stage3@test.local удалён со всеми следами (scripts/stage3-remove-test.mjs); REMINDER-записей в аудите 0; в БД 5 реальных аккаунтов (включая новый timyr112003@gmail.com, созданный владельцем — не тронут).
- PROJECT-README.md: раздел «Напоминания о занятиях (крон)» — три вида писем, настройки, crontab-примеры (VPS/контейнер/внешний сервис), dry-run, дедупликация.

Stage Summary:
- Этап 3 закрыт: приложение умеет слать педагогам дневную сводку (7:00), напоминание «за час» (крон каждые 10 мин) и недельный план (понедельник 7:00) — остаётся владельцу добавить 3 строки в crontab на сервере (инструкция в README). Крон в этой dev-среде не настроен — по расписанию письма пойдут после деплоя на VPS.
- Кандидаты на следующие этапы: UI-настройки напоминаний (время/вкл-выкл), «Забыли пароль», письмо «Требует внимания» владельцу (блок attention в stats уже считает), письма родителям.

---
Task ID: 32
Agent: Super Z (main)
Task: Починка «за час» + встроенный планировщик + переключатели уведомлений в настройках

Work Log:
- Диагноз владельца «не приходит за час до занятия»: напоминания срабатывали ТОЛЬКО при вызове роута, а тикающего планировщика в окружении не было — письма по расписанию не могли уходить в принципе. Проверка кода показала: логика hourly корректна (проверено отправками в Task 31).
- Рефакторинг: вся логика обхода вынесена из роута в src/lib/ep-reminder-engine.ts (runReminders(type, {dryRun})), роут стал тонкой обёрткой (секрет + валидация + JSON). parseSnapshot теперь возвращает и settings (notifyDaily/notifyHourly/notifyWeekly; undefined в снапшоте = включено — совместимость со старыми данными), движок пропускает учителя с выключенным типом («отключено в настройках аккаунта»).
- Встроенный планировщик: src/lib/ep-scheduler.ts (тик через 20 c после старта, затем каждые 10 мин; hourly всегда; daily/weekly в утреннем окне REMINDER_HOUR..+3 по умолчанию 7:00–9:59, weekly только по понедельникам; тихо, если почта не настроена; REMINDER_BUILTIN=0 отключает) + src/instrumentation.ts (register при старте сервера, NEXT_RUNTIME=nodejs, globalThis-защита от повторов).
- UI: в настройках учительского кабинета (ep-settings.tsx) новая карточка «Уведомления о занятиях» — три переключателя (Сводка на день / Напоминание за час / План на неделю, NotifyToggle в фирменном стиле), подпись с адресом получателя; настройки хранятся в снапшоте аккаунта (updateSettings → autosave), действуют на всех устройствах.
- .env / .env.example / docker-compose.yml: REMINDER_BUILTIN=1 (+REMINDER_HOUR опционально в compose/example).
- Проверки: tsc по src 0 ошибок; ESLint чисто. E2E планировщика: тестовый учитель с занятием +50 мин → перезапуск сервера → БЕЗ каких-либо curl первый тик сам отправил hourly (sent=2: stage3@test.local 15:26 И реальный timyr112003@gmail.com — занятие владельца «в 15:27»; владелец получил напоминание в Gmail автоматически). Дедупликация повторов — «уже отправлено». daily/weekly через движок — отправлены (в т.ч. реальному gmail-аккаунту владельца с его занятием). UI E2E: вход stage3@test.local → Настройки → 3 тумблера включены → выключение «за час» → снапшот в БД notifyHourly:false → движок: «отключено в настройках аккаунта» → включение обратно; тёмная тема, скриншот scripts/stage3-notifications-card.png; консоль без ошибок.
- Чистка: stage3@test.local удалён со всеми следами; в БД 5 реальных аккаунтов. README переписан: «Напоминания о занятиях» — встроенный планировщик по умолчанию, переключатели, внешний крон опционален.

Stage Summary:
- Напоминания теперь работают «из коробки»: встроенный планировщик шлёт письма сам (тик 10 мин), внешние кронтабы больше не обязательны; каждый педагог управляет своими уведомлениями в настройках кабинета. Проблема владельца воспроизведена по причине (не было тикающего механизма) и устранена; подтверждено реальным письмом в его Gmail.
- Кандидаты дальше: «Забыли пароль», письмо «Требует внимания» владельцу, письма родителям.

---
Task ID: 32
Agent: Super Z (main)
Task: Шестерёнка у карточки «Уведомления»: редактирование переменных — за сколько минут напоминать о занятии, время/дни недельной сводки, время дневной сводки.

Work Log:
- ep-types.ts: AppSettings += notifyDailyTime ('07:00'), notifyHourlyMinutes (60), notifyWeeklyTime ('07:00'), notifyWeeklyDays ([0]=Пн); дефолты в DEFAULT_SETTINGS.
- ep-reminders.ts: SnapshotSettings расширен; parseSnapshot валидирует и нормализует значения ('7:05'→'07:05', минуты 5–1440, дни 0–6 уникальные по возрастанию; поле не задано → дефолт, [] = недельный план выключен); новые defaultNotifySettings() и inSendWindow(now, start, 180) с переходом через полночь.
- ep-reminder-engine.ts: дневная сводка — окно [notifyDailyTime, +3ч); недельный план — сначала день из notifyWeeklyDays, затем окно от notifyWeeklyTime; напоминание — окно notifyHourlyMinutes вместо жёстких 60; понятные детали пропусков в dry-run.
- ep-scheduler.ts: тик каждые 10 мин теперь гоняет все три типа (hourly → daily → weekly); глобальное утреннее окно REMINDER_HOUR и привязка weekly к понедельнику удалены — «пора ли» решает движок по настройкам каждого педагога; REMINDER_HOUR убран из docker-compose.yml и .env.example.
- ep-settings.tsx: карточка «Уведомления о занятиях» — шестерёнка в шапке (акцентная, когда открыта) раскрывает панель: time-инпут «Расписание на текущий день», число 5–1440 «Напомнить перед занятием» (неконтролируемый input с key-премонтом, сохранение по blur/Enter, откат невалидного), time-инпут + чипсы Пн…Вс для недельного плана (вкл/выкл кликом, [] = не приходит); описания трёх строк стали динамическими (время, минуты с plural(), дни по-коротки); ep-input перебивал Tailwind w-* (width:100% в globals.css) — ширины заданы инлайн (118/96px).
- Проверки: node scripts/stage4-check-settings.mjs — 28 утверждений ок (дефолты, нормализация, мусор, границы, полуночь); tsc по src 0 ошибок; ESLint чисто (set-state-in-effect устранён отказом от локального state у поля минут).
- E2E движка (тестовый учитель stage4@test.local, окно 90 мин, занятие +50 в окне / +95 вне): dry-run daily/hourly/weekly — отправка только в своих окнах; негативные: минуты=30 → «занятий нет», daily 03:00 → «сейчас не время», дни=[] → «не входит в дни»; реальная отправка hourly через роут (sent=1) + дедупликация повтора.
- E2E UI (agent-browser): вход stage4@test.local → Настройки → шестерёнка → панель; смена времени на 08:30 и клик «Вс» → в БД notifyDailyTime='08:30', notifyWeeklyDays=[5,6]; описания обновились («Каждый день в 08:30», «Сб, Вс в 15:14», «за 90 минут»); движок сразу увидел 08:30 → «сейчас не время»; консоль без ошибок; скриншоты scripts/stage4-card-closed.png, stage4-panel-open.png, stage4-panel-edited.png.
- Чистка: stage4@test.local удалён со всеми следами (5 реальных аккаунтов); README «Напоминания о занятиях» переписан под персональные времена/дни.

Stage Summary:
- Каждый педагог настраивает время своих писем по шестерёнке в карточке «Уведомления»: за сколько минут напоминать (по умолчанию 60), во сколько сводка на день (07:00), время и дни недельного плана (Пн 07:00). Всё хранится в снапшоте аккаунта — без миграций БД, старые снапшоты получают дефолты. Движок уважает настройки при любом способе запуска (встроенный планировщик / внешний крон), дедупликация и окна «3 часа» защищают от дублей и потерь при перезапуске.
- Скрипты этапа: scripts/stage4-{check-settings,make-test-user,set-settings,remove-test}.mjs. Бэкап перед работой: backups/englishpro-20260926-121444.db.

---
Task ID: 33
Agent: Super Z (main)
Task: Шестерёнка уведомлений — строго индивидуальные настройки аккаунта + ползунок недельного плана, привязанный к дням

Work Log:
- Диагноз жалобы «настройки общие, сделай для каждого»: архитектурно notify-настройки лежат в снапшоте аккаунта (UserData.data.settings), но были реальные утечки между аккаунтами: (1) resetLocalData() при смене аккаунта не сбрасывал settings — настройки предыдущего аккаунта оставались в store; (2) extractData() при отсутствии settings в снапшоте подставлял ТЕКУЩИЙ store (чужие настройки) вместо дефолтов — и они затирались в новый аккаунт первым же автосейвом; (3) clearLocalDataWithBackup() (новый аккаунт) тоже оставлял чужие settings. Реальный кейс утечки: thomfvdasage@yandex.ru без снапшота; у timyr112003@gmail.com — notifyWeekly:true при notifyWeeklyDays:[] (ползунок справа, а план фактически не приходит).
- ep-sync.ts: resetLocalData() и clearLocalDataWithBackup() теперь сбрасывают settings к DEFAULT_SETTINGS; extractData() фолбэк — {...DEFAULT_SETTINGS} вместо useAppStore.getState().settings (с комментарием, почему это важно). Итог: при входе/имперсонации каждый аккаунт видит ТОЛЬКО свои настройки (или дефолты), никакой «общности».
- ep-settings.tsx: (1) toggleWeekday — снятие последнего дня недельной сводки теперь пишет notifyWeekly:false (ползунок «План на неделю» автоматически уходит влево, в неактивное положение); выбор первого дня при пустом списке возвращает notifyWeekly:true; клики по дням при уже выбранных днях флаг notifyWeekly не трогают (ручное выключение ползунком не сбивается при правке дней). (2) Ползунок недельного плана: checked = notifyWeekly !== false && дней > 0; включение без выбранных дней подставляет понедельник (без дней письмо бы всё равно не ушло). (3) Описания строк: «Выключен: не выбран ни один день (шестерёнка вверху)» / «Выключен — включите переключателем» / «Вс в 07:00 — занятия на ближайшие 7 дней»; подпись в панели: «Настройки индивидуальны для этого аккаунта»; нижняя подпись: «У каждого аккаунта свои время и дни».
- Окружение снова сбрасывалось (.env только с DATABASE_URL) — восстановлен .env (SMTP Яндекса, CRON_SECRET, REMINDER_TIMEZONE, REMINDER_BUILTIN=1) и пересоздан .env.example; dev-сервер перезапущен, health 200.
- Проверки: tsc по src 0 ошибок; ESLint чисто. E2E (agent-browser, тестовые stage6a@/stage6b@test.local — scripts/gear2-make-test-users.mjs): (1) у stage6a (снапшот без notify-полей) дефолты 07:00/60/Пн; снятие единственного дня Пн → ползунок недельного плана влево, в БД notifyWeekly:false, notifyWeeklyDays:[]; выбор Вс → ползунок вправо, БД notifyWeekly:true,[6]; ручное выключение/включение ползунка сохраняет выбранные дни ([6], не Пн); dailyTime 09:45 сохранён в БД. (2) Изоляция: выход → вход stage6b (БЕЗ снапшота) → у Б дефолты 07:00/07:00/Пн, а НЕ 09:45/[6] учителя А; в БД у Б снапшот не появился; повторный вход А → его 09:45 и Вс на месте. (3) Движок dry-run: stage6a weekly → «(6-й день недели) не входит в дни» (его дни=[6]=Вс, сегодня Сб), daily → «приходит в 09:45 — сейчас не время» — движок уважает персональные дни/время каждого. Консоль браузера без ошибок. Скриншот scripts/gear2-panel-a.png.
- Чистка: тестовые удалены (scripts/gear2-remove-test.mjs), 5 реальных аккаунтов; REMINDER-записей после рестарта 0 (4 старые — от утренней сессии, не тронуты).
- PROJECT-README.md: раздел «Напоминания о занятиях» дополнен — «Настройки строго индивидуальны» (не переносятся между аккаунтами) + связка «нет дня → ползунок влево», «первый день → включён».
- Бэкап перед работой: backups/englishpro-20260926-pre-gear2.db.

Stage Summary:
- Два требования владельца выполнены: (1) шестерёнка уведомлений — настройки строго индивидуальны для каждого аккаунта, утечки «общих» значений между аккаунтами при входе/имперсонации устранены на уровне sync-движка; (2) если в недельной сводке не выбран ни один день — недельные уведомления отключаются и ползунок автоматически уходит влево; выбор дня возвращает его вправо. Движок и планировщик подтверждают персональные дни/время каждого учителя (dry-run).
- Кандидаты дальше: «Забыли пароль», письмо «Требует внимания» владельцу, письма родителям.

---
Task ID: 34
Agent: Super Z (main)
Task: У каждого уведомления — своя шестерёнка для настройки (запрос пользователя: «Теперь для каждого уведомления своя шестеренка для настройки»)

Work Log:
- Бэкап БД перед изменениями: backups/englishpro-20260926-152544.db (+ pre-gear2 ранее).
- Перечитал src/lib/ep-reminder-engine.ts и src/lib/ep-reminders.ts: движок уже поддерживал per-teacher параметры (notifyDailyTime, notifyHourlyMinutes 5–1440, notifyWeeklyTime, notifyWeeklyDays[], weeklyEnabled = toggle && дни.length > 0) — бэкенд менять не пришлось, только UI.
- src/components/ep-settings.tsx: убрал общую шестерёнку вверху карточки «Уведомления о занятиях» (showNotifyTiming → открытая панель openNotify: 'daily'|'hourly'|'weekly'|null, аккордеон). Теперь у каждой из трёх строк — своя шестерёнка рядом с ползунком, открывающая свою панель настроек:
  * «Сводка на день» → время отправки (input time, default 07:00);
  * «Напоминание перед занятием» → минуты до начала (неконтролируемый number 5–1440, сохранение по blur/Enter, key-ремаунт при внешнем изменении);
  * «План на неделю» → время + кнопки дней Пн–Вс; панель доступна и при выключенном ползунке (это способ исправить «Выключен: не выбран ни один день»).
- Сохранена логика из прошлого этапа: пустой weeklyDays ⇒ notifyWeekly=false и ползунок влево; выбор первого дня ⇒ notifyWeekly=true; включение ползунка без дней подставляет понедельник.
- Подписи строк синхронны с настройками («Каждый день в 08:30…», «Письмо за 30 минут…», «Ср в 09:00…»); текст под заголовком: «Настройки индивидуальны для этого аккаунта и сохраняются автоматически»; футер: «У каждого уведомления своя шестерёнка».
- tsc --noEmit: чисто по src/; ESLint ep-settings.tsx: 0 ошибок. Перезапуск dev-сервера.
- E2E (agent-browser): создал тестового учителя gear-e2e-test@mail.ru (ученик + занятие сегодня 19:00); проверил: три отдельных шестерёнки рендерятся (aria-label «Настроить время дневной сводки / Настроить напоминание перед занятием / Настроить план на неделю»); панели открываются/закрываются по одной; время дня 07:00→08:30 — строка обновилась, стор и серверный UserData получили 08:30; минуты 60→30 — стор 30, «Письмо за 30 минут…»; снял единственный день Пн ⇒ weeklyDays=[] notifyWeekly=false, ползунок weekly влево (aria-checked=false), тексты «Выключен: не выбран ни один день» + «Ни один день не выбран»; выбрал Ср ⇒ notifyWeekly=true, days=[2], ползунок вправо; время недели 07:00→09:00 — «Ср в 09:00 — занятия на ближайшие 7 дней». Ошибок консоли нет. Скриншот download/notify-per-gear.png.
- Сухой прогон dry=1: daily — тестовому «приходит в 08:30», остальным «в 07:00» (per-teacher время работает); hourly — тестовому «ушло бы письмо» (занятие 19:00 в его окне 30 мин); weekly — суббота не входит в [2], скип. После проверки тестовый аккаунт удалён каскадом (UserData уходит вместе с пользователем), остались только реальные аккаунты.
- PROJECT-README.md: раздел «Напоминания о занятиях» переписан под «у каждого из трёх уведомлений своя шестерёнка».

Stage Summary:
- В кабинете учителя (Настройки → «Уведомления о занятиях») у каждого уведомления теперь своя шестерёнка: день → время, занятие → минуты, неделя → время+дни. Настройки per-user (UserData), аккордеон, авто-сохранение, автосинк на сервер.
- Изменён один файл UI: src/components/ep-settings.tsx (бэкенд/движок без изменений — per-teacher параметры уже поддерживались).
- Проверено: tsc/ESLint чисто, E2E в браузере, dry=1 уважает персональные время/дни/минуты, тестовые данные удалены.

---
Task ID: 35
Agent: Super Z (main)
Task: Соцсети ученика — добавление только в настройках карточки, на карточке только значки (запрос пользователя)

Work Log:
- Перечитал текущее состояние: модалка EpStudentSocialModal (открывалась с карточки кнопкой +/pen), карточка со значками-ссылками + кнопкой редактирования, родительские соцсети уже в редакторе («Родитель»).
- src/components/ep-student-modal.tsx: во вкладку «Ученик» (настройки карточки) добавлен блок «Социальные сети ученика» — поля ВКонтакте/Telegram/MAX с фирменными иконками, валидацией и подсказкой «пустое поле = удалить ссылку»; черновик studentSocialsDraft инициализируется из existing.socials; общая валидация вынесена в buildSocialsFromDraft(draft, setErrors) (используется и для родителя); при ошибке — переключение на вкладку «Ученик» + тост; соцсети сохраняются через updateStudent (socials: studentSocials в payload, merge {...st, ...s} корректно и сохраняет, и удаляет ссылки).
- src/components/ep-students.tsx: с карточки удалена кнопка «+ / ручка» (openModal('student-social')); блок значков рендерится только при наличии соцсетей (hasSocials), значки — ссылки на профиль (target=_blank, stopPropagation, tooltip с коротким адресом).
- Удалён файл src/components/ep-student-social-modal.tsx; из ep-layout.tsx убраны импорт, aria-метка и case 'student-social'; из ep-store.ts удалено действие updateStudentSocials и неиспользуемый импорт StudentSocials.
- tsc --noEmit: чисто по src/; ESLint (4 файла): 0 ошибок.
- E2E (agent-browser, тестовый учитель social-e2e-test@mail.ru): во вкладке «Ученик» есть 3 поля соцсетей; instagram.com/anna в ВК → форма не отправляется, «Некорректная ссылка ВКонтакте. Пример: https://vk.com/username»; исправил на vk.com/anna_smirnova → ученик создан, socials нормализованы (https:// добавлен); на карточке 3 значка-ссылки с корректными href, кнопки добавления нет; повторное открытие редактора — поля предзаполнены; очистил MAX и сохранил → значок MAX исчез, в сторе socials = {vk, telegram}; карточные кнопки (баланс/правка/абонемент/архив) не задеты. Ошибок консоли нет. Скриншот download/socials-badges-card.png.
- Тестовый аккаунт удалён каскадом (остались только реальные пользователи). README (п.6 истории версий) обновлён. Архив пересобран.

Stage Summary:
- Соцсети ученика теперь добавляются/редактируются ТОЛЬКО в настройках карточки ученика (редактор, вкладка «Ученик»); на карточке — только значки-кнопки добавленных сетей (открывают профиль в новой вкладке).
- Изменено: ep-student-modal.tsx, ep-students.tsx, ep-layout.tsx, ep-store.ts; удалён ep-student-social-modal.tsx.

---
Task ID: 36
Agent: Super Z (main)
Task: Этап 4 — «Забыли пароль» (самостоятельный сброс) + напоминания о занятиях ученикам и родителям (общие настройки по умолчанию + личные на карточке), удаление учеников только из архива

Work Log:
- Бэкап БД: backups/englishpro-20260927-pre-reset-notify.db. Prisma-схема: модель PasswordResetToken (userId FK cascade, tokenHash unique, expiresAt, usedAt) + обратная связь User.resetTokens; prisma db push (без потери данных).
- Часть A — API: POST /api/auth/forgot-password (всегда {ok:true} — анти-перебор; rate-limit 3 письма/15 мин на адрес in-memory; в БД только sha256-хеш токена, TTL 60 мин; новый запрос аннулирует прежние токены; письмо через simpleMailHtml со ссылкой {APP_URL||origin}/?reset=...; аудит PASSWORD_RESET_REQUESTED) и POST /api/auth/reset-password (проверка токена/срока/usedAt, проверка статуса ACTIVE, отказ при совпадении с текущим паролем, $transaction: новый scrypt-хеш + usedAt; revokeUserSessions; аудит PASSWORD_RESET_DONE).
- Часть A — UI: ep-auth.tsx — кнопка «Забыли пароль?» + встроенная форма восстановления с состояниями login/forgot/forgot-sent (сообщение не раскрывает существование аккаунта); новый ep-reset-password.tsx (пароль + повтор, ошибки, экран успеха); ep-app.tsx — ?reset=<token> на маршруте / открывает EpResetPassword вместо экрана входа (только когда не залогинен), closeReset чистит URL через history.replaceState.
- Часть B — типы/стор: ep-types.ts — StudentNotifySettings {mode: inherit|custom, toStudent?, toParent?, minutes?}, Student.notify?, AppSettings += notifyStudentLesson/notifyStudentLessonMinutes/notifyParentLesson/notifyParentLessonMinutes (дефолты false/60/false/60 — ВЫКЛЮЧЕНО); ep-store.ts — действие updateStudentNotify(id, notify) (mode inherit хранится как отсутствие поля).
- Часть B — снапшот/движок: ep-reminders.ts — ReminderStudent += email/parentEmail/parentName/notify, SnapshotLesson += studentId (для старых снапшотов без studentIds), SnapshotSettings += 4 поля (ученик/родитель дефолтно выключены), парсинг с валидацией; новые сборщики buildStudentReminderMail («Привет, {имя}! твоё занятие...») и buildParentReminderMail («Здравствуйте, {родитель}! занятие у {ребёнка}...») — без заметок педагога; ep-reminder-engine.ts — hourly-ветка разделена: письмо педагогу по своим настройкам + независимый проход по ученикам/родителям каждого planned-занятия (участники = studentIds || studentId, архивники скип, свои настройки перекрывают общие, окно per-student, скип с пояснением при пустом email); дедуп-ключи `${studentId}|student-hourly|${lessonId}` и `${studentId}|parent-hourly|${lessonId}` (в разборе маркеров — список типов с lessonId).
- Часть B — настройки: ep-settings.tsx — две новые строки «Напоминание ученику»/«Напоминание родителю» с шестерёнками (openNotify расширен, неконтролируемые поля минут snm-/pnm- по onBlur 5–1440), подписи «Выключено — письма не отправляются»/«Письмо за N минут», обновлён футер карточки.
- Часть B — карточка: ep-students.tsx — кнопка «Удалить» убрана у активных учеников; добавлена шестерёнка «Настройки» (openModal('student-notify'), aria-label «Настройки ученика {имя}») слева от «В архив», с акцентной точкой при notify.mode==='custom'; handleDelete упрощён (только архив → deleteStudentKeepLessons, история сохраняется); массовое удаление показывается только во вкладке «Архив» и использует deleteStudentKeepLessons.
- Часть B — модалка: новый ep-student-notify-modal.tsx «Настройки ученика» (задел на будущие разделы): режим «Как у всех / Свои настройки» (сегмент-кнопки aria-pressed), в inherit — сводка эффективных общих значений, в custom — тумблеры «Слать ученику»/«Слать родителю» с показом email и предупреждением-тостом при пустом, минуты 5–1440 по onBlur; автосохранение через updateStudentNotify; зарегистрирована в ep-layout.tsx (case 'student-notify', aria-метка).
- Проверки: tsc --noEmit по src/ чисто; ESLint чисто; тест «Забыли пароль» scripts/test-password-reset.js — 6 блоков (токен 60 мин, нормализация email, аннулирование прежних, неверный токен/короткий пароль отклонены, смена через API подтверждена scrypt-проверкой + usedAt + аудит DONE, повторное использование отклонено, вход со старым паролем отклонён/с новым ок); тест движка scripts/test-student-notify.js (dry=1) — 8/8: письма педагогу/ученику/родителю по общим настройкам, у Анны custom (родителю за 200, ученику нет), у Ольги без email — пояснение, занятие через 400 мин и отменённое не попадают; реальный прогон ранее: sent=5 errors=0, дедуп-маркеры работают. E2E agent-browser: «Забыли пароль?» → письмо отправлено; ?reset= → форма нового пароля (несовпадение ловится) → успех → «Перейти ко входу» чистит URL → вход с новым паролем; карточки: активная [баланс, правка, абонемент, Настройки, В архив] без «Удалить», модалка настроек (inherit → сводка, custom → тумблеры+минуты, сохранение, точка на шестерёнке, персистентность после reload), настройки: 5 строк с шестерёнками, минуты 45 сохраняются, тумблер off → «Выключено», архив: [Вернуть из архива, Удалить], удаление с подтверждением → архив пуст. Ошибок консоли нет. Скриншоты: download/student-notify-modal.png, download/notify-settings-5-rows.png.
- Тестовый пользователь ep-test-reset@yandex.ru удалён каскадом + тестовые аудиты и дедуп-маркеры вычищены (остались только реальные аккаунты). README: п.10–11 истории версий, раздел «Восстановление пароля («Забыли пароль?»)», раздел «Напоминания о занятиях» дополнен (5 уведомлений, личные настройки ученика, удаление только из архива), «Где что лежит» обновлён. Архив пересобран.

Stage Summary:
- Этап 4 закрыт полностью: самостоятельное восстановление пароля по одноразовой ссылке (60 мин, sha256-хеш в БД, анти-перебор, отзыв сессий) и напоминания «занятие скоро начнётся» ученикам/родителям (глобально выключены по умолчанию, личные настройки ученика через шестерёнку «Настройки» на карточке перекрывают общие; заметки педагога в письма не уходят; дедуп через аудит; сбой письма не ломает обход).
- Удаление учеников теперь только из архива (одиночное и массовое), история уроков сохраняется.
- Новая таблица PasswordResetToken — единственная миграция этапа; данных клиентов не касается.

---
Task ID: 36
Agent: Super Z (main)
Task: Проверка корректности уведомлений (педагог/ученики/родители) без сбоев; улучшение текста письма-напоминания (текст — только после согласования с пользователем)

Work Log:
- Найдена критическая проблема: .env усечён до одной строки DATABASE_URL (перезаписан 18:02) — без SMTP_USER/SMTP_PASS/CRON_SECRET почта не отправляется вовсе, крон-роут отвечает 401. Восстановил .env из подтверждённых ранее значений (SMTP Яндекс, MAIL_FROM, CRON_SECRET, REMINDER_TIMEZONE), перезапустил dev-сервер.
- Прогнал scripts/test-student-notify.js (dry=1): 8/8 проверок — письмо педагогу, ученику «как у всех», родителю, custom-настройки Анны (родителю за 200, ученику нет), Ольга без email → пояснение, занятие за 400 мин и отменённое не попадают.
- Разобрал реальный тик планировщика 18:11 UTC по аудитам: отправлены все 6 писем без единого сбоя (3 педагогу les-1/2/3, ученику Ивану, родителю Марии, родителю Анны по custom-окну 200 мин), дедуп-маркеры записаны, REMINDER_ERROR за 14 дней — 0, дублей дедуп-ключей — 0.
- scripts/audit-notify-check.mjs: показывал настройки с неверными дефолтами (поле undefined → «выкл», движок же трактует undefined daily/hourly/weekly как ВКЛ, student/parent как ВЫКЛ) — исправлен, дефолты зеркалят parseSnapshot.
- Найден источник «фантомных» отправок: тестовый скрипт оставлял учителя с фейковыми занятиями в БД → встроенный планировщик отправлял настоящие письма на example.com. Фикс: скрипт теперь сам удаляет тестового пользователя и маркеры сразу после прогона; остатки вычищены (scripts/cleanup-test-notify-user.mjs).
- Надёжность: тик планировщика 10 мин при минимальном окне напоминания 5 мин → при окне < 10 мин часть напоминаний молча пропускалась (реальный аккаунт Томми использует окно 5 мин!). TICK_MS 10→5 мин + комментарии; обновлены упоминания в PROJECT-README.md и шапке cron-роута. tsc по src/ чисто.
- Текст писем (ep-reminders.ts) пока НЕ менялся: найдена грамматическая ошибка в письме родителю («у Анна Тестовая занятие» — нет склонения), вариант исправления предложен пользователю на согласование вместе с удалением «начнётся через N минут».

Stage Summary:
- Уведомления проверены по всей цепочке: сухой прогон 8/8, реальный тик 6/6 писем, 0 ошибок SMTP за 14 дней, 0 дублей, краевые случаи (нет email, custom, отмена, окно) — корректно.
- Починено: .env (причина тотального сбоя почты), тик 5 мин (гарантия доставки при любом окне ≥ 5 мин), самоочистка тестового скрипта, правдивый аудит-отчёт.
- Ждёт согласования: новый текст писем-напоминаний без «через N минут» + исправление склонения имени в письме родителю.

---
Task ID: 36-b
Agent: Super Z (main)
Task: Внедрение утверждённых пользователем текстов писем-напоминаний (ученику и родителю)

Work Log:
- ep-reminders.ts: buildStudentReminderMail и buildParentReminderMail переписаны по утверждённому формату — без «через сколько минут»/«скоро начнётся»; ученику: «Сегодня, {дата}, состоится занятие по английскому языку в {время}. Длительность: X. Тема: Y.»; родителю: «Напоминаем, что сегодня, {дата}, состоится занятие по английскому языку.» + отдельные строки «Ученик: {имя}» (именительный падеж — проблема склонения снята), «Длительность: X.», «Тема: Y.»; тема родителю теперь «EnglishPro: {имя} — занятие сегодня в {время}»; параметр inMinutes удалён из обоих сборщиков; групповые занятия — пометка «(групповое занятие)»; тема/пустые поля — как раньше (строка «Тема» опускается, приветствие «Здравствуйте!» без имени).
- ep-reminder-engine.ts: вызовы обоих сборщиков без inMinutes.
- scripts/test-student-notify.js: проверка темы письма родителю обновлена под новый формат («Иван Тестовый — занятие сегодня»).
- scripts/preview-reminder-texts.mjs: превью текстовых версий (включая краевые случаи — без темы, без имени родителя, группа).
- Проверки: tsc по src/ чисто; dry-run 8/8; темы в dry-выводе соответствуют новому формату; самоочистка тестовых данных работает.

Stage Summary:
- Письма ученику и родителю приведены к утверждённому тексту; относительные формулировки («через N минут», «скоро начнётся») убраны, грамматика с любыми именами корректна.
- Письмо ПЕДАГОГУ (buildHourlyMail) сознательно не тронуто: пользователь утвердил только ученика/родителя; «начнётся через N минут» там сохранён — вопрос о унификации задан пользователю.

---
Task ID: 37
Agent: Super Z (main)
Task: Секции в настройках уведомлений; главный выключатель с предупреждением; письмо педагогу без «через N минут»; перепроверка текстов

Work Log:
- ep-settings.tsx: карточка «Уведомления о занятиях» разделена на две секции в едином окне — «Личные уведомления — письма вам на адрес аккаунта» (день/занятие/неделя) и «Уведомления для учеников и родителей» (ученику/родителю) с пояснением главного выключателя; подписи выключенных ползунков ученика/родителя: «Выключено — письма не отправляются, даже если у ученика включены свои настройки».
- ep-reminder-engine.ts: ГЛАВНЫЙ ВЫКЛЮЧАТЕЛЬ — wantStudent/wantParent теперь require settings.notifyStudentLesson/notifyParentLesson (общий OFF → письма не уходят, даже при custom-тумблерах ученика); при общем OFF в details добавляется пояснение; buildHourlyMail вызывается без inMinutes.
- ep-student-notify-modal.tsx: янтарный баннер «Уведомления отключены в общих настройках» (role=alert) в обоих режимах, текст различает какой из каналов выключен; докоммент обновлён; подпись «Кому и за сколько присылать напоминание о занятии».
- ep-reminders.ts: buildHourlyMail переписан без «через N минут»/«скоро начнётся» — «Сегодня, {дата}, в {время} занятие — {имена}.» + длительность/тема/заметки (заметки только в письме педагогу); inMinutes удалён из сигнатуры.
- scripts/test-student-notify.js: добавлена фаза 4б (общие OFF → 4/4: письма педагогу остаются, ученику/родителю нет даже с custom, пояснение выводится); stage3-preview.mjs вызов без inMinutes.
- Причина замечания пользователя «текст не изменён»: после правки текстов dev-сервер не перезапускался — встроенный планировщик работал на старом коде; сервер перезапущен, новые тексты подтверждены.
- Реальная проверка: scripts/send-preview-mails.mjs отправил 3 письма (ученику/родителю/педагогу, темы с маркером [Проверка]) на thomasage@yandex.ru — SMTP ок, тело = производственный текст.
- E2E (agent-browser): вход под e2e-notify@test.local → Настройки: обе секции и подписи на месте (скриншот download/notify-settings-sections.png); модалка ученика: баннер предупреждения при общих OFF в режиме «Свои настройки» с включёнными тумблерами (download/student-modal-warning.png). Тестовый пользователь удалён.
- tsc/ESLint чисто; README обновлён (главный выключатель, режимы, история версий).

Stage Summary:
- Настройки уведомлений разделены на «Личные» и «Для учеников и родителей» в одной карточке; общий ползунок стал главным выключателем (перекрывает личные настройки), в модалке ученика при этом показывается предупреждение.
- Все три письма-напоминания (педагогу, ученику, родителю) в едином утверждённом формате без «через N минут»; превью-письма отправлены на реальный ящик владельца.
