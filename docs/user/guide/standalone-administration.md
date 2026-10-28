# Deploy and administer a standalone installation

English | [中文](standalone-administration.zh.md)

This guide covers a deployment on your own servers: what whoever installs it does once, and what your administrator does from then on. The first half is the installation; the second is the console your administrator works in afterwards, where sign-in is configured without editing a file again.

A deployment on your own hardware serves your own staff: it has accounts and no credit metering. Balances, allowances, and per-person quotas belong to the hosted service and are absent here, not set to zero.

## Part one: install it

### Create the profile

Install Node.js, then create a profile from the `enterprise` template under a name of your own:

```sh
npx @deepseek-ai/dsh --profile acme --from-default-profile enterprise
```

That writes `$DSH_HOME/profiles/acme/` — a `package.json` holding the ordered bundle list, and a `cordis.patch.yml` holding your own composition layer. The first start refuses to boot, and the message says why: the deployment has not named its people. That refusal is the design, not a fault — nothing invents who administers an installation.

### Name your people

Write the roster into the profile's `cordis.patch.yml`:

```yaml
- id: people
  name: '@deepseek-ai/dsh-managed-people/directory'
  config:
    people:
      - id: ada
        displayName: Ada
        role: platform-administrator
      - id: bea
        displayName: Bea
        role: member
```

Three roles exist. A `platform-administrator` administers the whole deployment. A `tenant-administrator` administers one organization and names it with an `organization:` field. A `member` administers nothing. On a standalone deployment the people who run it are platform administrators.

The `id` is permanent: sessions, grants, and sign-in bindings are written against it. Pick something stable, such as an employee number or an account name, rather than a display name.

### Admit the first administrator

Signing in has two halves. A **channel** authenticates somebody against a directory — WeCom, DingTalk, or Feishu. An **admission binding** says which person in your roster that directory identity is. An empty binding list admits nobody, which is deliberate: connecting a directory must not, by itself, let everyone in it sign in.

The first administrator cannot configure anything before signing in, so their channel and their binding go in the same file, once:

```yaml
- id: sign-in-channel-head-office
  name: '@deepseek-ai/dsh-wecom'
  config:
    corpId: ww-your-corp-id
    agentId: '1000002'
    secret: WECOM_APP_SECRET

- id: sign-in-admission
  name: '@deepseek-ai/dsh-managed-people/admission'
  config:
    bindings:
      - channel: wecom
        issuer: ww-your-corp-id
        subject: ada-wecom-userid
        person: ada
```

`issuer` and `subject` are what the directory reports: for WeCom the corp id and the member's UserId, for DingTalk the corp id and the person's unionId, for Feishu the tenant key and the union id. Your directory's own console shows them. `channel` is the channel's id — `wecom`, `dingtalk`, or `feishu` for one written here; a channel added later from the UI has its own id, which that page displays.

### Supply the first secret

`secret:` names a credential reference, never the secret itself. Before the first start there is no console to type it into, so the value comes from the environment:

```sh
WECOM_APP_SECRET=... npx @deepseek-ai/dsh --profile acme
```

An inherited environment variable wins over everything else and cannot be edited from inside the product, which is what makes it the right place for a bootstrap secret. For a value that survives a restart, write `$DSH_HOME/.env` instead and give it mode `600`. Secrets saved from the console later live in `$DSH_HOME/.credentials.yaml`, which the product writes and reads itself.

### Start it

```sh
npx @deepseek-ai/dsh --profile acme --port 8080 --no-open
```

Flags after the profile belong to the web app: `--host`, `--port`, `--trusted-host`, `--no-open`. To check the composed tree without starting anything, use `--dump-config`.

Then hand the rest of this guide to the customer's administrator.

## Part two: administer it

Everything below happens in the product, with no file editing and no restart.

### Configure channels

Open **Settings → Sign-in**. The page lists the channels this deployment serves and offers a form to add one. Pick the directory, name the button, fill in the settings that directory needs — WeCom takes a corpid and an agentid, DingTalk an AppKey, Feishu an App ID — and type the application secret. Saving stores the secret in the credential store, mounts the channel, and the sign-in screen offers it immediately.

Each row says whether the channel is **serving**. A row that reads **not serving** is stored but not mounted: the deployment mounts no plugin for that kind, or that kind refused the settings. Correct the settings and save again; the record is kept so nothing has to be retyped.

Each row also shows a **channel id**. That id is what an admission binding names the channel by — a channel added from the UI gets its own id, so a binding written for it admits nobody through any other channel, including another one of the same kind.

### Add the rest of your staff

Everybody after the first administrator is added from **Settings → People**: a name, what they may do, the organization their standing is in, and then the directory identity admitted as them. Adding somebody admits nobody until that identity is bound, and the row says so.

The written roster stays the operator's. The people named in the profile are shown on that page marked **from configuration**, with no edit: the file is read again at every boot, so a change made from the page would be undone. That is also the recovery path — the administrator written in the file cannot be locked out from the page.

The identity is typed, not searched: the **directory** is what the channel calls the directory it verified them at (the corpid, the tenant key), and the **identity in that directory** is their stable id there. Getting one wrong admits nobody rather than the wrong person.

### Rotate a secret

Edit the channel, type the new secret, and save. Leaving the secret field empty keeps the stored one, so renaming a channel never means retyping a secret nobody can read back. There is no second slot: for a moment one secret or the other is in force, so rotate when the directory has accepted the new one.

### Remove a channel

Removing a channel ends the way in for everybody who signed in through it and deletes its application secret. The page asks for an acknowledgement before it does either. The identities admitted through that channel stay on their people and admit nobody, because no channel reports that id any more; withdraw them from Settings → People when you are not bringing the channel back.

### Upgrade it

Installing a newer dsh does not rewrite your profile, with one exception: when a release moves a capability into a different bundle, a profile whose bundle list is still exactly one this product shipped is brought forward to the current list. A list you edited — a plugin added, a bundle removed — is left exactly as you wrote it, and a profile already on the current list is not written at all.

So after an upgrade that changed the shape of a profile, check `$DSH_HOME/profiles/<name>/package.json` against the shipped list only if you have edited it; the release notes name what moved. An edited profile that misses a new bundle keeps working, except where the release moved rows between composition layers — the startup log names the rows it could not place.

### Who can do what

Configuring channels requires an administrator's standing. A member who opens the page reads that only an administrator can configure sign-in, and sees nothing else. A tenant administrator — on a deployment that has organizations — configures only their own organization's channels, and the deployment-wide ones stay out of reach.

## Continue

- [Configure models](./providers.md)
- [Use the Web UI](./index.md)
