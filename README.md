# Service Projects

Монорепозиторий с четырнадцатью самостоятельными сервисами и личными кабинетами. У каждого проекта собственный Node.js backend, SQLite-база пользователей и cookie-сессии.

## Проекты

| Проект | Назначение | Локальный порт |
|---|---|---:|
| `nodewatch-console` | Мониторинг серверов | 4173 |
| `fastletter` | Доставка документов | 4203 |
| `north-language` | Онлайн-школа языков | 4204 |
| `deskroom` | Бронирование коворкингов | 4205 |
| `green-index` | Уход за растениями | 4206 |
| `clearbook` | Бухгалтерия самозанятых | 4207 |
| `city-frame` | Архив городской фотографии | 4208 |
| `form-school` | Курсы по дизайну | 4209 |
| `rentbase` | Аренда техники | 4210 |
| `safebox` | Городское хранение вещей | 4211 |
| `pawline` | Ветеринарная клиника | 4212 |
| `veloforge` | Велосипедная мастерская | 4213 |
| `sidequest` | Платформа локальных событий | 4214 |
| `wattboard` | Домашний энергомониторинг | 4215 |

## Скриншоты

### NODEWATCH

![Панель мониторинга NODEWATCH](docs/screenshots/nodewatch.png)

### FASTLETTER

![Личный кабинет FASTLETTER](docs/screenshots/fastletter.png)

### NORTH LANGUAGE

![Учебный кабинет NORTH LANGUAGE](docs/screenshots/north-language.png)

### DESKROOM

![Кабинет бронирования DESKROOM](docs/screenshots/deskroom.png)

### GREEN INDEX

![Ботанический журнал GREEN INDEX](docs/screenshots/green-index.png)

### CLEARBOOK

![Финансовый кабинет CLEARBOOK](docs/screenshots/clearbook.png)

### CITY FRAME

![Фотоархив CITY FRAME](docs/screenshots/city-frame.png)

### FORM SCHOOL

![Учебная студия FORM SCHOOL](docs/screenshots/form-school.png)

### RENTBASE

![Кабинет аренды RENTBASE](docs/screenshots/rentbase.png)

### SAFEBOX

![Кабинет хранения SAFEBOX](docs/screenshots/safebox.png)

### PAWLINE

![Ветеринарная карта PAWLINE](docs/screenshots/pawline.png)

### VELOFORGE

![Заказ-наряд VELOFORGE](docs/screenshots/veloforge.png)

### SIDEQUEST

![Городская афиша SIDEQUEST](docs/screenshots/sidequest.png)

### WATTBOARD

![Энергомониторинг WATTBOARD](docs/screenshots/wattboard.png)

## Запуск

Из корня репозитория:

```bash
npm run dev:fastletter
```

Либо из папки конкретного проекта:

```bash
cd fastletter
npm run dev
```

Демо-вход для проектов FASTLETTER–WATTBOARD: `demo@service.ru` / `demo123`.

Демо-вход NODEWATCH: `demo@nodewatch.io` / `nodewatch`.

## Проверка

```bash
npm run check
```

Каждый проект является автономным: внутри находятся собственные `index.html`, `styles.css`, `app.js`, `server.js`, `package.json` и `README.md`.

При первом запуске backend автоматически создаёт базу `.data/app.db` и демо-пользователя. Пароли хешируются через `crypto.scrypt`, а серверные сессии передаются через `HttpOnly` cookie. Файлы баз исключены из Git.
