import { NextRequest, NextResponse } from 'next/server'
import { getUserNotifications } from '../../actions/resolveContest'

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId')
  
  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
  }
  
  const notifications = await getUserNotifications(userId)
  
  return NextResponse.json({ notifications })
}
