const site = 'https://greatgeargenerator-bucala.surge.sh';
const expected = process.env.BUILD_SHA;
if (!/^[a-f0-9]{40}$/.test(expected ?? '')) throw new Error('BUILD_SHA is required.');

// Bound the verification; retries cover transient network errors after publishing.
for (let attempt = 1; attempt <= 5; attempt++) {
  try {
    const response = await fetch(`${site}/build-info.json?commit=${expected}`, {
      cache: 'no-store', signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`HTTPS status ${response.status}`);
    const info = await response.json();
    if (info.commit !== expected) throw new Error('The live revision differs from the tested commit.');
    console.log(`Verified ${site} at ${expected}`);
    break;
  } catch (error) {
    if (attempt === 5) throw error;
    console.log(`Revision check ${attempt}/5 failed; retrying in 5 seconds.`);
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}
