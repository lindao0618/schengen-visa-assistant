import { NextResponse } from 'next/server';
import { findUserByEmail, createUser } from "@/lib/users"

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ message: '邮箱和密码不能为空' }, { status: 400 });
    }

    // 检查用户是否已存在
    const existingUser = await findUserByEmail(email);

    if (existingUser) {
      return NextResponse.json({ message: '该邮箱已被注册' }, { status: 409 }); // 409 Conflict
    }

    // 创建新用户
    const newUser = await createUser(email, password);
    
    console.log(`新用户注册成功: ${email}`);

    // 不要在响应中返回密码
    const { password: _, ...userWithoutPassword } = newUser;

    return NextResponse.json({ user: userWithoutPassword, message: '用户注册成功' }, { status: 201 });
  } catch (error) {
    console.error('注册 API 错误:', error);
    return NextResponse.json({ 
      message: '服务器内部错误', 
      error: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}