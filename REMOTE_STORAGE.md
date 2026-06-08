# Удалённая CSV-база через GitHub

Сайт остаётся на GitHub Pages, но данные участников нельзя безопасно писать в GitHub прямо из браузера: GitHub-токен был бы виден всем. Поэтому схема такая:

1. Сайт отправляет выдачу в Cloudflare Worker.
2. Worker хранит GitHub-токен как секрет.
3. Worker дописывает строку в CSV в приватном GitHub-репозитории.
4. Кнопка `CSV` на сайте скачивает полную выгрузку через Worker по коду.

## Что создать

1. Приватный GitHub-репозиторий для данных, например `nika-afisha-data`.
2. Fine-grained GitHub token с доступом только к этому репозиторию:
   - Repository permissions: `Contents` -> `Read and write`.
3. Бесплатный Cloudflare Worker.

## Переменные Worker

В настройках Worker добавь переменные:

```text
GITHUB_OWNER=dimonded1
GITHUB_REPO=nika-afisha-data
GITHUB_BRANCH=main
DATA_PATH=submissions.csv
ALLOWED_ORIGIN=https://dimonded1.github.io
ADMIN_KEY=любая_секретная_фраза_для_CSV
WRITE_KEY=любой_код_для_записи
```

`GITHUB_TOKEN` добавь именно как Secret, не как обычную переменную.

## Код Worker

Скопируй содержимое файла `cloudflare-worker.js` в Worker и задеплой.

## Подключить сайт

После деплоя Worker будет URL вида:

```text
https://nika-afisha-submissions.<аккаунт>.workers.dev
```

В `config.js` на сайте укажи:

```js
window.NIKA_CONFIG = {
  submissionsEndpoint: "https://nika-afisha-submissions.<аккаунт>.workers.dev",
  writeKey: "тот_же_WRITE_KEY",
};
```

Потом закоммить и запушь сайт.

## Как будет работать

- Участник проходит форму и получает животное.
- Запись сохраняется локально как резерв и отправляется в GitHub-базу.
- Подбор учитывает дневные выдачи из GitHub-базы, поэтому разные устройства меньше повторяют одних и тех же животных.
- Кнопка `CSV` спросит код выгрузки. Введи `ADMIN_KEY`, и скачается полный CSV за всё время.

## Важно

Не используй публичный репозиторий для `submissions.csv`, если там будут Telegram, телефон или email. Для персональных данных нужен приватный репозиторий.
