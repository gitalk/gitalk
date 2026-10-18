import type { Messages } from '../i18n'

/** Persian (Farsi). Typed against `zh`, the source locale. */
export const fa: Messages = {
  meta: {
    title: 'Gitalk 2.0 — کامپوننت دیدگاه بر پایه GitHub Discussions',
    description:
      'Gitalk 2.0: کامپوننتی برای دیدگاه‌ها بر پایه GitHub Discussions. نسخه‌های بدون فریم‌ورک، React و Vue.'
  },
  nav: {
    features: 'ویژگی‌ها',
    usage: 'نحوه استفاده',
    demo: 'نمایش',
    theme: 'تغییر پوسته',
    language: 'تغییر زبان',
    github: 'مخزن GitHub'
  },
  ambient: {
    aria: 'صدای محیط: {season} · {state}',
    stateOn: 'روشن',
    stateOff: 'خاموش',
    defaultTag: ' (پیش‌فرض)',
    hint: 'برای تغییر کلیک کنید · کلیک راست یا ← → برای فصل · ↑ ↓ برای صدا ({volume}٪)',
    seasons: {
      spring: 'باران بهار',
      summer: 'حشرات تابستان',
      autumn: 'آتش پاییز',
      winter: 'برف زمستان'
    }
  },
  hero: {
    eyebrow: '// GITHUB DISCUSSIONS POWERED COMMENTS',
    titleLine1: 'دیدگاه‌ها،',
    titleLine2: 'سبک مثل ',
    titleEm: 'یک خط کد',
    lede: 'GitHub Discussions یا Issues را به بخش دیدگاه‌های خود تبدیل کنید. با یک فرمان یک پروکسی سبک راه‌اندازی کنید. بدون پایگاه داده، و دیدگاه‌ها بی‌درنگ همگام می‌شوند.',
    statsTitle: 'اعداد کلیدی',
    stats: {
      lines: { value: '4', label: 'گام تا راه‌اندازی', note: 'ساخت App، پر کردن متغیرها، استقرار، افزودن.' },
      comments: { value: '∞', label: 'ظرفیت دیدگاه', note: 'بر دوش GitHub Discussions.' },
      size: { label: 'کوچک‌ترین نیست', note: 'حجم واقعی انتقال پس از gzip.' },
      deps: { value: '0', label: 'وابستگی زمان اجرا', note: 'لایه رندر داخل بسته است.' },
      stars: { label: 'Stars', note: 'توجه جامعه در GitHub.' }
    },
    modeLabel: 'حالت چیدمان', endpointLabel: 'نقطه پایانی', modeDefault: 'پیش‌فرض', modeInline: 'درون‌خطی'
  },
  getStarted: {
    eyebrow: 'راه‌اندازی',
    title: 'چهار گام تا دیدگاه‌ها',
    lede: 'سه گام کار شماست — ساخت App، پر کردن مقادیر، افزودن کامپوننت — و یک گام یک فرمان است. ترتیب مهم است: گام سه به مقادیر گام دو نیاز دارد.',
    steps: [
      {
        title: 'یک GitHub App بسازید',
        body: 'در Settings → Developer settings → GitHub Apps. دسترسی‌های Discussions: Read and write و Metadata: Read-only را بدهید؛ در Callback URL بنویسید <نشانی پروکسی شما>/oauth/callback؛ Webhook را خاموش کنید (لازم نیست).',
        code: ''
      },
      {
        title: 'متغیرها را آماده کنید',
        body: 'App ID، Client ID، Client Secret و کلید خصوصی (محتوای کامل .pem، نه اثر انگشت SHA256) را در یک .env بنویسید و کلید نشست را با openssl rand -hex 32 بسازید.',
        code: 'GITHUB_APP_ID=…\nGITHUB_APP_PRIVATE_KEY="-----BEGIN…"\nSESSION_ENCRYPTION_KEY=$(openssl rand -hex 32)'
      },
      {
        title: 'با یک فرمان مستقر کنید',
        body: 'CLI ابتدا همه مقادیر را بررسی می‌کند و هر مقدار گمشده را نام می‌برد، سپس اعتبارنامه‌ها را به‌عنوان secret بارگذاری می‌کند، استقرار می‌دهد، /health را بررسی می‌کند و در پایان نشانی‌ای را چاپ می‌کند که باید در proxy بگذارید.',
        code: 'npx github:gitalk/deploy -c .env -t cloudflare'
      },
      {
        title: 'کامپوننت را اضافه کنید',
        body: 'نشانی چاپ‌شده را در proxy بگذارید و دیدگاه‌ها کار می‌کنند. پوسته، حالت تاریک و چندزبانی همراه خود کامپوننت می‌آید.',
        code: "new Gitalk({\n  clientID: 'Iv23li…',\n  proxy: 'https://gitalk-proxy.<account>.workers.dev'\n})"
      }
    ],
    more: 'CloudBase، میزبانی شخصی و توضیح همه متغیرها → README ابزار استقرار',
    domainTitle: 'دامنه اختصاصی',
    domainBody: 'دامنه‌ای که در Cloudflare است مستقیم متصل می‌شود؛ در جای دیگر باید یک رکورد CNAME را دستی اضافه کنید. دامنه اختصاصی CloudBase به ثبت ICP هم نیاز دارد — هر دو کار دستی است. نشانی callback اپ هم فقط از رابط وب تغییر می‌کند (اپ‌های متعلق به سازمان را نمی‌توان با API تغییر داد).'
  },
  features: {
    eyebrow: "// WHAT'S NEW",
    title: "What's New",
    lede: '2.0 هسته را از نو نوشته است: Discussions به‌صورت پیش‌فرض، ورود با OAuth و هیچ کلیدی در مرورگر.',
    items: [
      {
        title: 'Discussions به‌صورت پیش‌فرض',
        body: 'دیدگاه‌ها در Discussions می‌مانند، فهرست issue را شلوغ نمی‌کنند و مشکل v1 با برچسب‌های بیش از ۵۰ نویسه هم از بین رفته است.'
      },
      {
        title: 'Issues به‌صورت اختیاری',
        body: 'سایت‌های قدیمی با گذاشتن backend: "issues" داده‌های قبلی را نگه می‌دارند و مهاجرت می‌تواند صفحه‌به‌صفحه پیش برود.'
      },
      {
        title: 'بدون فریم‌ورک / React / Vue',
        body: 'یک هسته، سه شیوه استفاده. هر پوسته کمتر از 1 kB است و با نسخه فریم‌ورک پروژه شما درگیر نمی‌شود.'
      },
      {
        title: 'دیگر کلیدی لو نمی‌رود',
        body: 'v1 مقدار clientSecret را در فرانت‌اند می‌گذاشت و به یک پروکسی ناشناس می‌فرستاد. 2.0 از edge function استفاده می‌کند که خودتان مستقر می‌کنید: در مرورگر کلیدی نیست.'
      },
      {
        title: 'صفر وابستگی زمان اجرا',
        body: 'لایه رندر فقط Preact است. تاریخ با Intl.RelativeTimeFormat بومی و Markdown با HTML رندرشده توسط GitHub.'
      },
      {
        title: 'زنجیره ابزار مدرن',
        body: 'Vite 8 · TypeScript 7 · Vitest 5 · مونوریپوی pnpm · انتشار خودکار با release-please.'
      }
    ]
  },
  flow: {
    eyebrow: '// DATA FLOW',
    title: 'داده‌ها چگونه جریان می‌یابند',
    lede: 'خواندن ناشناس، نوشتن پس از ورود. این محدودیت نیست؛ تنها راهی است که شکل APIهای GitHub تحمیل می‌کند.',
    anonTitle: 'بازدیدکننده ناشناس',
    anonBadge: 'بدون ورود',
    anonPoints: [
      'خواندن دیدگاه‌ها از REST API (۶۰ درخواست در ساعت برای هر IP)',
      'دریافت مستقیم HTML رندرشده توسط GitHub',
      'درخواست‌های تکراری با ETag در سهمیه حساب نمی‌شوند'
    ],
    authTitle: 'کاربران واردشده',
    authBadge: 'OAuth',
    authPoints: [
      'دیدگاه، پاسخ و واکنش با GraphQL',
      '۵۰۰۰ امتیاز در ساعت، هر پرس‌وجو یک امتیاز',
      'توکن در localStorage می‌ماند و هر زمان می‌توان لغوش کرد'
    ],
    note: 'نوشتن باید از GraphQL بگذرد، چون GitHub برای Discussions هیچ API نوشتن REST ندارد (مسیرهای `POST` اصلاً وجود ندارند). سهمیه ناشناس GraphQL دقیقاً `0` است، پس «خواندن ناشناس + نوشتن پس از ورود» شکلی است که معماری تحمیل می‌کند، نه تنبلی.'
  },
  tabs: {
    eyebrow: '// GET STARTED',
    title: 'سه شیوه استفاده',
    lede: 'یک هسته؛ ورودی‌ای را انتخاب کنید که به پروژه شما نزدیک‌تر است.',
    items: {
      vanilla: {
        label: 'بدون فریم‌ورک',
        hint: 'یک تگ script و یک خط مقداردهی',
        code: `<!-- ۱. بارگذاری بسته -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/gitalk@2/dist/gitalk.css">
<script src="https://cdn.jsdelivr.net/npm/gitalk@2/dist/gitalk.js"></script>

<!-- ۲. ظرف -->
<div id="gitalk-container"></div>

<!-- ۳. مقداردهی -->
<script>
  const gitalk = new Gitalk({
    clientID: 'Iv1.xxxxxxxx',
    owner: 'you',
    repo: 'comments',
    admin: ['you'],
    id: location.pathname,   // شناسه یکتای صفحه
    number: 42,              // شماره discussion موجود (توصیه می‌شود)
    backend: 'discussions',  // پیش‌فرض؛ سایت‌های قدیمی می‌توانند 'issues' بدهند
    perPage: 10
  })

  gitalk.render('gitalk-container')
</script>`
      },
      react: {
        label: 'React',
        hint: 'peerDependency: react >= 18',
        code: `import { Gitalk } from '@aifire/gitalk-react'
import '@aifire/gitalk/style.css'

export function Comments() {
  return (
    <Gitalk
      options={{
        clientID: 'Iv1.xxxxxxxx',
        owner: 'you',
        repo: 'comments',
        admin: ['you'],
        number: 42,
        backend: 'discussions',
        perPage: 10
      }}
    />
  )
}`
      },
      vue: {
        label: 'Vue',
        hint: 'peerDependency: vue >= 3.4',
        code: `<script setup lang="ts">
import { Gitalk } from '@aifire/gitalk-vue'
import '@aifire/gitalk/style.css'

const options = {
  clientID: 'Iv1.xxxxxxxx',
  owner: 'you',
  repo: 'comments',
  admin: ['you'],
  number: 42,
  backend: 'discussions',
  perPage: 10
}
</script>

<template>
  <Gitalk :options="options" />
</template>`
      }
    },
    note: 'ورود باید از proxy بگذرد: `github.com/login/oauth/access_token` هدرهای CORS برنمی‌گرداند، پس مرورگر نمی‌تواند تبادل توکن را تنها انجام دهد. استقرار همان چهار گام بالاست؛ CloudBase و میزبانی شخصی در README مخزن آمده است.'
  },
  footer: {
    note: 'MIT · بر پایه GitHub Discussions',
    repo: 'دیدن مخزن'
  }
}
