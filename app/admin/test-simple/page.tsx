export default function TestSimplePage() {
  return (
    <div style={{ 
      padding: '20px',
      backgroundColor: 'red',
      color: 'white',
      fontSize: '24px',
      textAlign: 'center'
    }}>
      <h1>测试页面</h1>
      <p>如果你能看到这个红色背景的页面，说明页面渲染正常。</p>
      <p>时间: {new Date().toLocaleString()}</p>
    </div>
  )
}
