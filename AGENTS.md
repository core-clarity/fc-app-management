# エージェント引継ぎ資料

## 最重要：Next.js の起動・ビルド

このリポジトリでは、開発サーバーと本番ビルドが同じ `.next` ディレクトリを使います。

- `npm run dev` と `npm run build` を同時に実行しない。
- `npm run dev` はプロジェクトごとに1つだけ起動する。
- 開発サーバーを起動する前に、既存の端末・Node/Nextプロセス・3000番台ポートを確認する。
- 既存の同プロジェクトの開発サーバーが動いていれば再利用する。
- ビルドが必要な場合は、先に開発サーバーを `Ctrl+C` で停止する。
- `./8948.js` などのチャンクエラーが出た場合は、同プロジェクトのサーバーを停止し、`.next` を削除してから `npm run dev` を1つだけ起動する。

### 通常の開発手順

```powershell
# 3000番台の待受を確認
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -in 3000,3001,3002 } |
  Select-Object LocalPort,OwningProcess

# このプロジェクトのNode/Nextプロセスを確認
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -like '*fc-app-management*' } |
  Select-Object ProcessId,ParentProcessId,CommandLine

# 既存の同プロジェクトサーバーがない場合だけ実行
npm run dev
```

起動ログに `Local: http://localhost:3000` と `Ready` が出たことを確認する。
別の端末で `npm run build` を実行してはいけない。ビルド検証時は開発サーバーを停止してから実行する。

### 今回の障害記録（2026-08-31）

既存の `next dev` が動いている状態で `npm run build` を実行したため、`.next` に開発用と本番用の生成物が混在し、Missing chunk / Invalid hook call が発生した。
クリーンアップ後に開発サーバーを1つだけ起動することで復旧した。

## 実装・確認

- Next.js 14.2.35 / React 18 / Recharts を使用。
- エントリー分析画面は `/analytics/entries`。
- コード変更後は `npm run lint` と `npx tsc --noEmit` を実行する。
- `npm run build` は開発サーバーを停止した状態でのみ実行する。
