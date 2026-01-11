<template>
  <div class="room-join">
    <h1>Присоединиться к комнате</h1>
    <div v-if="$route.params.code">
      <p>Код комнаты: {{ $route.params.code }}</p>
    </div>
    <router-link to="/" class="btn">
      Назад на главную
    </router-link>
  </div>
</template>

<script>
export default {
  name: 'RoomJoin',
  
  mounted() {
    console.log('Room code:', this.$route.params.code)
  }
}
</script>

<style scoped>
.room-join {
  padding: 40px;
  text-align: center;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.btn {
  display: inline-block;
  margin-top: 20px;
  padding: 15px 30px;
  background: #9b59b6;
  color: white;
  text-decoration: none;
  border-radius: 10px;
  font-weight: 600;
  transition: all 0.3s ease;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(155, 89, 182, 0.3);
}
</style>