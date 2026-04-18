export const theme = {
  colors: {
    bg: { primary:'#0a0a0c', secondary:'#111114', tertiary:'#18181b', elevated:'#1e1e22', hover:'#27272a' },
    border: { subtle:'#1e1e22', default:'#27272a', strong:'#3f3f46' },
    text: { primary:'#e4e4e7', secondary:'#a1a1aa', muted:'#71717a', inverse:'#09090b' },
    accent: { blue:'#3b82f6', blueHover:'#2563eb', green:'#22c55e', amber:'#f59e0b', red:'#ef4444', purple:'#a855f7' },
    track: { video:'#3b82f6', audio:'#22c55e', text:'#f59e0b' },
  },
  spacing: { xs:2, sm:4, md:8, lg:12, xl:16, xxl:24 },
  radius: { sm:4, md:6, lg:8, full:9999 },
  fontSize: { xs:10, sm:11, md:13, lg:15, xl:18 },
} as const;
