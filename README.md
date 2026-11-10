# Ruiner

Разбор матча Dota 2 по Match ID (OpenDota): руинер, MVP, графики золота/опыта, билд и вклад.

**Публичный сайт (работает без Cursor):** https://artwhat.github.io/Ruiner/

Он задеплоен на GitHub Pages. Закрытие Cursor / остановка `npm run dev` на него не влияет.

### Откуда берутся матчи

1. **OpenDota** (основной источник, как у who-ruined)
2. **Запасной proxy** (Cloudflare Worker в `worker/`) — OpenDota → Steam
3. **Steam Web API** (если в `localStorage.ruiner_steam_key` лежит ключ с https://steamcommunity.com/dev/apikey)
4. **Кэш в браузере** — уже открытые матчи открываются даже когда API лежит

Proxy URL: `VITE_MATCH_PROXY` или `localStorage.ruiner_match_proxy` (без `/` на конце).

Локальная разработка (гаснет вместе с терминалом Cursor):

```bash
npm install
npm run dev
```

Открой http://127.0.0.1:5173

Сборка для GitHub Pages: `GITHUB_PAGES=1 npm run build` (output в `dist/`).
