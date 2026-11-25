# Deploy na Vercel e APK pelo PWABuilder

## 1. Publicar na Vercel

1. Entre em [vercel.com](https://vercel.com) com a conta do GitHub.
2. **Add New → Project**, escolha o repositório `pila` e clique em **Import**.
3. A Vercel lê o `vercel.json` sozinha (Vite, `npm run build`, pasta `dist`). Não mude nada e clique em **Deploy**.
4. Ao final você recebe um endereço como `https://pila-xxxx.vercel.app`.

A cada push na `main` a Vercel publica de novo. Branches e PRs ganham endereços de prévia próprios.

### Conferir o PWA no Chrome (computador ou Android)

- Abra o endereço e veja se aparece o ícone/opção **Instalar app**.
- No computador: DevTools → **Application → Service workers** deve mostrar `sw.js` ativo, e **Manifest** sem erros.
- Teste offline: abra o app uma vez, ative o modo avião e abra de novo. Ele deve carregar normalmente.

## 2. Gerar o APK no PWABuilder

1. Abra [pwabuilder.com](https://www.pwabuilder.com) e cole o endereço da Vercel.
2. Confira o relatório (manifest, service worker e segurança devem estar verdes).
3. **Package for stores → Android → Generate Package**.
   - Package ID sugerido: `app.pila.twa`
   - Mantenha **Signing key: new** e guarde o arquivo de assinatura que ele gerar.
     Ele é necessário para publicar atualizações do mesmo APK.
4. Baixe o `.zip`. Dentro dele:
   - `*.apk`: para instalar direto no celular.
   - `*.aab`: só se um dia for publicar na Play Store.
   - `assetlinks.json`: veja o passo 3.

## 3. Tirar a barra de endereço do APK (Digital Asset Links)

Sem esse passo o APK funciona, mas mostra uma barrinha com o endereço no topo.

1. Copie o `assetlinks.json` do zip para `public/.well-known/assetlinks.json` neste projeto.
2. Faça commit e push. A Vercel já serve esse arquivo com o tipo certo (configurado no `vercel.json`).
3. Desinstale e instale o APK de novo.

## 4. Instalar o APK no Android

1. Envie o `.apk` para o celular (Drive, cabo, WhatsApp para você mesma…).
2. Abra o arquivo. O Android vai pedir para permitir **instalar apps desta fonte**: permita só para o app que abriu o arquivo.
3. Pronto: o Pila aparece com o ícone azul na tela inicial.

## Sobre os dados

O APK roda o Pila pelo Chrome do celular (Trusted Web Activity). Os dados ficam no armazenamento do Chrome
para o endereço da Vercel. Se você trocar de endereço (outro domínio), os dados não vão junto:
**faça backup** em *Mais → Salvar backup* antes de qualquer troca.
