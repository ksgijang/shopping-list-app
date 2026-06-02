import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE_URL = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(FILE_URL);
  // 이전 테스트 데이터 제거 후 재로드
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // ─── 1. 초기 상태 ─────────────────────────────────────────
  console.log('\n[ 1. 초기 상태 ]');
  const emptyMsg = await page.locator('#empty');
  assert(await emptyMsg.isVisible(), '빈 상태 메시지가 보임');
  assert((await page.locator('li').count()) === 0, '리스트 아이템 없음');

  // ─── 2. 아이템 추가 ────────────────────────────────────────
  console.log('\n[ 2. 아이템 추가 ]');

  // 버튼 클릭으로 추가
  await page.fill('#itemInput', '사과');
  await page.click('button:has-text("추가")');
  assert((await page.locator('li').count()) === 1, '아이템 1개 추가됨 (버튼 클릭)');
  assert(await page.locator('li .item-text').first().textContent() === '사과', '아이템 텍스트 "사과" 확인');

  // Enter 키로 추가
  await page.fill('#itemInput', '바나나');
  await page.press('#itemInput', 'Enter');
  assert((await page.locator('li').count()) === 2, '아이템 2개 추가됨 (Enter 키)');

  // 세 번째 아이템
  await page.fill('#itemInput', '우유');
  await page.press('#itemInput', 'Enter');
  assert((await page.locator('li').count()) === 3, '아이템 3개 추가됨');

  // 빈 문자열은 추가 안 됨
  await page.fill('#itemInput', '   ');
  await page.click('button:has-text("추가")');
  assert((await page.locator('li').count()) === 3, '공백 입력 시 아이템 추가 안 됨');

  // 빈 상태 메시지 사라짐
  assert(!(await emptyMsg.isVisible()), '아이템 추가 후 빈 메시지 숨겨짐');

  // 통계 표시
  const stats = await page.locator('#stats').textContent();
  assert(stats.includes('3'), '통계에 전체 3개 표시됨');

  // ─── 3. 체크 기능 ──────────────────────────────────────────
  console.log('\n[ 3. 체크 기능 ]');

  const firstCheckbox = page.locator('li input[type="checkbox"]').first();
  await firstCheckbox.check();

  const firstLi = page.locator('li').first();
  assert(await firstLi.evaluate(el => el.classList.contains('checked')), '체크 시 .checked 클래스 추가됨');

  const statsAfterCheck = await page.locator('#stats').textContent();
  assert(statsAfterCheck.includes('완료') && statsAfterCheck.includes('1'), '통계에 완료 1개 표시됨');

  // "완료된 항목 삭제" 버튼 나타남
  assert(await page.locator('#clearBtn').isVisible(), '완료된 항목 삭제 버튼 표시됨');

  // 체크 해제
  await firstCheckbox.uncheck();
  assert(!(await firstLi.evaluate(el => el.classList.contains('checked'))), '체크 해제 시 .checked 클래스 제거됨');
  assert(!(await page.locator('#clearBtn').isVisible()), '완료 없으면 삭제 버튼 숨겨짐');

  // ─── 4. 아이템 삭제 ────────────────────────────────────────
  console.log('\n[ 4. 아이템 삭제 ]');

  // 두 번째 아이템("바나나") 삭제
  const deleteButtons = page.locator('.delete-btn');
  await deleteButtons.nth(1).click();
  assert((await page.locator('li').count()) === 2, '삭제 후 아이템 2개 남음');

  // 남은 텍스트 확인
  const texts = await page.locator('.item-text').allTextContents();
  assert(!texts.includes('바나나'), '"바나나" 삭제됨');
  assert(texts.includes('사과') && texts.includes('우유'), '"사과", "우유" 남아있음');

  // ─── 5. 완료된 항목 일괄 삭제 ─────────────────────────────
  console.log('\n[ 5. 완료된 항목 일괄 삭제 ]');

  // 남은 두 아이템 모두 체크
  const checkboxes = page.locator('li input[type="checkbox"]');
  await checkboxes.nth(0).check();
  await checkboxes.nth(1).check();
  assert((await page.locator('li.checked').count()) === 2, '두 아이템 모두 체크됨');

  await page.click('#clearBtn');
  assert((await page.locator('li').count()) === 0, '완료된 항목 일괄 삭제 후 0개 남음');
  assert(await emptyMsg.isVisible(), '모두 삭제 후 빈 메시지 다시 표시됨');

  // ─── 6. localStorage 영속성 ────────────────────────────────
  console.log('\n[ 6. localStorage 영속성 ]');

  await page.fill('#itemInput', '오렌지');
  await page.press('#itemInput', 'Enter');
  await page.fill('#itemInput', '포도');
  await page.press('#itemInput', 'Enter');
  assert((await page.locator('li').count()) === 2, '2개 아이템 추가됨');

  // 페이지 새로고침
  await page.reload();
  assert((await page.locator('li').count()) === 2, '새로고침 후 아이템 유지됨 (localStorage)');
  const reloadedTexts = await page.locator('.item-text').allTextContents();
  assert(reloadedTexts.includes('오렌지') && reloadedTexts.includes('포도'), '새로고침 후 데이터 정확함');

  // ─── 결과 ──────────────────────────────────────────────────
  await browser.close();

  console.log(`\n${'─'.repeat(40)}`);
  console.log(`결과: ${passed + failed}개 중 ${passed}개 통과, ${failed}개 실패`);
  console.log('─'.repeat(40));

  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('\n테스트 실행 오류:', err.message);
  process.exit(1);
});