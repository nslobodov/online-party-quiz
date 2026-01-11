<template>
  <div class="home">
    <div class="background-animation"></div>
    <div class="screen-content">
        <div class="logo-container">
            <div class="logo">
                <i class="fas fa-horse-head"></i>
                <span class="logo-text">HORSE QUIZ</span>
                <span class="logo-subtext">ВИКТОРИНА О ЛОШАДЯХ</span>
            </div>
        </div>
        <div class="card-container">
            <div class="card">
                <h1 class="title-glow">КОННАЯ ВИКТОРИНА</h1>
                <div class="button-container">
                    <button @click="showQRCode()" class="btn-create-room" id="btn-create-room">Создать комнату</button>
                    <router-link to="/host" class="btn-redirect-to-host-page">Управлять игрой</router-link>
                </div>
            </div>
        </div>
        <router-link to="/room" class="btn">
            Присоединиться к игре
        </router-link>
    </div>
  </div>
</template>

<script>
export default {
  name: 'HomeView'
}
</script>

<style scoped>
.home {
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
  background: #3498db;
  color: white;
  text-decoration: none;
  border-radius: 10px;
  font-weight: 600;
  transition: all 0.3s ease;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(52, 152, 219, 0.3);
}
</style>