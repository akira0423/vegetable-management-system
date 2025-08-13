import { cn, formatDateTime, formatDate } from '../utils'

describe('utils', () => {
  describe('cn (className merge)', () => {
    it('merges class names correctly', () => {
      expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
    })

    it('handles conditional classes', () => {
      expect(cn('base-class', true && 'conditional-class')).toBe('base-class conditional-class')
      expect(cn('base-class', false && 'conditional-class')).toBe('base-class')
    })

    it('handles empty inputs', () => {
      expect(cn()).toBe('')
      expect(cn('', null, undefined)).toBe('')
    })

    it('handles arrays and objects', () => {
      expect(cn(['class1', 'class2'])).toBe('class1 class2')
      expect(cn({ 'class1': true, 'class2': false })).toBe('class1')
    })
  })

  describe('formatDateTime', () => {
    beforeEach(() => {
      // Mock timezone to ensure consistent test results
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2024-01-15T10:30:00.000Z'))
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('formats date time correctly in Japanese locale', () => {
      const dateString = '2024-01-15T10:30:00.000Z'
      const formatted = formatDateTime(dateString)
      expect(formatted).toMatch(/2024/)
      expect(formatted).toMatch(/1月/)
      expect(formatted).toMatch(/15日/)
    })

    it('handles different date formats', () => {
      const dateString = '2023-12-25T15:45:30.000Z'
      const formatted = formatDateTime(dateString)
      expect(formatted).toMatch(/2023/)
      expect(formatted).toMatch(/12月/)
      // タイムゾーンの影響で日付が変わる可能性があるため、25日または26日を許可
      expect(formatted).toMatch(/(25|26)日/)
    })

    it('handles invalid date string gracefully', () => {
      const invalidDateString = 'invalid-date'
      const formatted = formatDateTime(invalidDateString)
      // 無効な日付の場合、Dateオブジェクトは"Invalid Date"を返すため、
      // toLocaleDateStringは"Invalid Date"相当の文字列を返す
      expect(formatted).toMatch(/Invalid|NaN|無効/)
    })
  })

  describe('formatDate', () => {
    beforeEach(() => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2024-01-15T10:30:00.000Z'))
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('formats date correctly in Japanese locale', () => {
      const dateString = '2024-01-15T10:30:00.000Z'
      const formatted = formatDate(dateString)
      expect(formatted).toMatch(/2024/)
      expect(formatted).toMatch(/1月/)
      expect(formatted).toMatch(/15日/)
      // Should not include time
      expect(formatted).not.toMatch(/10/)
      expect(formatted).not.toMatch(/30/)
    })

    it('handles different date formats', () => {
      const dateString = '2023-06-10T08:00:00.000Z'
      const formatted = formatDate(dateString)
      expect(formatted).toMatch(/2023/)
      expect(formatted).toMatch(/6月/)
      expect(formatted).toMatch(/10日/)
    })

    it('handles invalid date string gracefully', () => {
      const invalidDateString = 'invalid-date'
      const formatted = formatDate(invalidDateString)
      expect(formatted).toMatch(/Invalid|NaN|無効/)
    })
  })
})