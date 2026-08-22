# 71. Tab 0 Company 필수 배지 열폭 정렬

## 목표

Listing input 표에서 Company의 `Required` 배지가 Country 열 영역을 침범하지 않도록, 헤더와 입력 셀의 열 경계를 명확히 맞춘다.

## 작업 범위

1. Company와 Asset의 필수 배지를 수용할 수 있도록 열 폭을 명시한다.
2. 나머지 Listing 입력 열도 업무 입력량에 맞게 고정 폭을 배정한다.
3. 좁은 화면에서는 기존처럼 표 내부 가로 스크롤로 전체 열을 확인한다.

## 완료 기준

- Company와 Required 배지가 Company 열 안에 완전히 표시된다.
- Country를 포함한 인접 헤더·입력 셀 경계가 겹치지 않는다.
