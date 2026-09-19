import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  // 모든 경로를 '내 폴더 기준(상대경로)'으로 바꿉니다.
  // 이것이 없으면 index.html을 더블클릭해서 열 때 파일을 찾지 못합니다.
  base: './',

  // JS와 CSS를 index.html 하나로 합쳐주는 플러그인
  plugins: [viteSingleFile()],

  build: {
    // 하나로 합치면 파일이 커지므로 크기 경고를 끕니다.
    chunkSizeWarningLimit: 100000000,
    // CSS를 별도 파일로 쪼개지 않습니다.
    cssCodeSplit: false,
    // 압축 용량 계산을 건너뛰어 빌드를 빠르게 합니다.
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        // 나중에 불러오는 코드까지 모두 한 파일에 넣습니다.
        inlineDynamicImports: true,
      },
    },
  },
});