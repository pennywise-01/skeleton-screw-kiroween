import { NextResponse } from 'next/server';

export async function GET() {
  // Check if kiro-cli is available
  let kiroAvailable = false;
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    await execAsync('kiro-cli --version');
    kiroAvailable = true;
  } catch (err) {
    kiroAvailable = false;
  }

  return NextResponse.json({
    kiro: kiroAvailable,
    demo: process.env.DEMO_MODE === 'true',
    preferred: kiroAvailable ? 'kiro' : null,
  });
}
