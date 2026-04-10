import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

/** 展示用：一律按 Asia/Shanghai 格式化（适配 Sealos / 大陆部署） */
export function formatInShanghai(
  input: Date | string | number,
  template: string
): string {
  return dayjs(input).tz("Asia/Shanghai").format(template);
}

/** 文件名用时间戳（上海时区） */
export function shanghaiFileTimestamp(): string {
  return dayjs().tz("Asia/Shanghai").format("YYYYMMDD_HHmm");
}
