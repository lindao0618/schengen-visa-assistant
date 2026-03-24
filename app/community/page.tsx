"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MessageSquare, ThumbsUp, Send } from "lucide-react"
import { PageContainer } from "@/components/ui/page-container"

const posts = [
  {
    id: 1,
    author: "张三",
    avatar: "/placeholder.svg?height=40&width=40",
    content: "大家好！我最近申请了申根签证，有什么需要特别注意的吗？",
    likes: 5,
    comments: 2,
    time: "2小时前",
  },
  {
    id: 2,
    author: "李四",
    avatar: "/placeholder.svg?height=40&width=40",
    content: "我刚刚通过了美国签证面试！如果有人需要帮助，欢迎问我。",
    likes: 10,
    comments: 5,
    time: "5小时前",
  },
]

export default function CommunityPage() {
  const [newPost, setNewPost] = useState("")

  const handlePostSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // 这里应该添加发布新帖子的逻辑
    console.log("New post:", newPost)
    setNewPost("")
  }

  return (
    <div className="pt-20">
      <PageContainer>
        <div className="animate-fade-in">
          <h1 className="text-4xl font-bold mb-8 text-center text-white bg-gradient-to-r from-primary to-emerald-600 bg-clip-text text-transparent">
            签证申请社区
          </h1>

          <Card className="bg-zinc-900 border-zinc-800 mb-8 hover-scale">
            <CardHeader>
              <CardTitle className="text-white">发布新帖子</CardTitle>
              <CardDescription className="text-gray-400">分享您的经验或提出问题</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePostSubmit}>
                <Textarea
                  placeholder="写下您的想法..."
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-white mb-4 focus:ring-primary"
                />
                <Button type="submit" variant="gradient">
                  发布 <Send className="ml-2 h-4 w-4" />
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {posts.map((post) => (
              <Card key={post.id} className="bg-zinc-900 border-zinc-800 hover-scale animate-slide-up">
                <CardContent className="pt-6">
                  <div className="flex items-start space-x-4">
                    <Avatar className="ring-2 ring-primary/20">
                      <AvatarImage src={post.avatar} alt={post.author} />
                      <AvatarFallback className="bg-primary/10 text-primary">{post.author[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-white">{post.author}</h3>
                        <span className="text-sm text-gray-400">{post.time}</span>
                      </div>
                      <p className="mt-2 text-gray-300">{post.content}</p>
                      <div className="mt-4 flex items-center space-x-4">
                        <Button variant="ghost" size="sm" className="text-gray-400 hover:text-primary hover:bg-primary/10">
                          <ThumbsUp className="mr-2 h-4 w-4" /> {post.likes}
                        </Button>
                        <Button variant="ghost" size="sm" className="text-gray-400 hover:text-primary hover:bg-primary/10">
                          <MessageSquare className="mr-2 h-4 w-4" /> {post.comments}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </PageContainer>
    </div>
  )
}
