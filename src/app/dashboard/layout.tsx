import { requireAuth } from '@/lib/auth'
import ResponsiveSidebar from '@/components/dashboard/responsive-sidebar'
import DashboardHeader from '@/components/dashboard/header'
import { ToastProvider } from '@/components/ui/toast'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireAuth()

  return (
    <ToastProvider>
      <div className="h-screen bg-gray-50">
      <div className="flex h-full">
        {/* Responsive Sidebar */}
        <ResponsiveSidebar />
        
        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
          {/* Header */}
          <DashboardHeader user={user} />
          
          {/* Page content */}
          <main className="flex-1 overflow-y-auto bg-white">
            <div className="container mx-auto px-6 py-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
    </ToastProvider>
  )
}