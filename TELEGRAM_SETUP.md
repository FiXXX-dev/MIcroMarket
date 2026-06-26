# Telegram-уведомления — настройка

Две Supabase Edge-функции:

| Функция | Назначение |
|---|---|
| `telegram-notify` | Мгновенное сообщение владельцу при каждой оплате + списание остатков |
| `telegram-report` | Ответ на команду `/report` — сводка продаж за сегодня |

## 1. Создать бота

1. В Telegram напишите **@BotFather** → `/newbot` → задайте имя.
2. Скопируйте **токен** (вид `123456:ABC-DEF...`).
3. Узнайте свой **chat_id**: напишите **@userinfobot** — он пришлёт ваш `id` (число).
4. Напишите своему новому боту любое сообщение (иначе бот не сможет вам писать).

## 2. Установить Supabase CLI и задеплоить функции

```bash
# один раз
npm i -g supabase
supabase login
supabase link --project-ref ufignylbumjqpkojvdwc

# секреты (SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY добавляются автоматически)
supabase secrets set TELEGRAM_BOT_TOKEN=123456:ABC-... TELEGRAM_CHAT_ID=123456789

# деплой (--no-verify-jwt обязателен: вызовы идут без JWT)
supabase functions deploy telegram-notify --no-verify-jwt
supabase functions deploy telegram-report --no-verify-jwt
```

> Без CLI можно создать функции и в Dashboard → Edge Functions, вставив код из
> `supabase/functions/*/index.ts`, и задать секреты там же.

## 3. Подключить webhook для `/report`

```bash
curl "https://api.telegram.org/bot<ТОКЕН>/setWebhook?url=https://ufignylbumjqpkojvdwc.supabase.co/functions/v1/telegram-report"
```

Проверка: `curl "https://api.telegram.org/bot<ТОКЕН>/getWebhookInfo"`

## 4. Готово

- Любая оплата в киоске → мгновенное сообщение в Telegram.
- Команда `/report` боту → сводка за сегодня (выручка, заказы, топ-товары, низкий остаток).

### Заметки
- Остатки списываются на сервере (`telegram-notify`), поэтому отчёт и каталог
  показывают актуальные числа. Киоск также уменьшает остаток локально для мгновенного отклика.
- `telegram-report` отвечает в тот чат, откуда пришла команда — работает для любого
  авторизованного владельца, добавленного в бота.
- Часовой пояс отчёта — Asia/Tashkent (UTC+5).
