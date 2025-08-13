import { createClient } from "@/lib/supabase/server"

export async function getDashboardStats(companyId: string) {
  try {
    const supabase = await createClient()
    
    // サンプルデータを返す（実際のデータベースが準備できるまで）
    return {
      totalVegetables: 12,
      activeTasks: 8,
      upcomingDeadlines: 3,
      completedTasks: 15,
      totalPhotos: 127,
      recentActivity: [
        {
          id: "1",
          type: "harvesting",
          action: "トマトの収穫を完了しました",
          timestamp: new Date().toISOString()
        },
        {
          id: "2",
          type: "fertilizing",
          action: "レタスの施肥作業を実施しました",
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        },
        {
          id: "3",
          type: "seeding",
          action: "新しい区画にキュウリを植付けしました",
          timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
        }
      ]
    }
  } catch (error) {
    console.error("Dashboard stats error:", error)
    return {
      totalVegetables: 0,
      activeTasks: 0,
      upcomingDeadlines: 0,
      completedTasks: 0,
      totalPhotos: 0,
      recentActivity: []
    }
  }
}

export async function getUpcomingTasks(companyId: string, limit: number = 5) {
  try {
    const supabase = await createClient()
    
    // サンプルデータを返す（実際のデータベースが準備できるまで）
    return [
      {
        id: "1",
        name: "トマトの収穫",
        start_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        vegetable_id: "1",
        vegetable: {
          id: "1",
          name: "トマト",
          variety_name: "桃太郎"
        },
        assigned_user: {
          full_name: "田中太郎"
        }
      },
      {
        id: "2",
        name: "レタスの施肥",
        start_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        vegetable_id: "2",
        vegetable: {
          id: "2",
          name: "レタス",
          variety_name: "グリーンリーフ"
        },
        assigned_user: {
          full_name: "佐藤花子"
        }
      },
      {
        id: "3",
        name: "キュウリの水やり",
        start_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        vegetable_id: "3",
        vegetable: {
          id: "3",
          name: "キュウリ",
          variety_name: "夏すずみ"
        },
        assigned_user: {
          full_name: "山田一郎"
        }
      }
    ]
  } catch (error) {
    console.error("Upcoming tasks error:", error)
    return []
  }
}
